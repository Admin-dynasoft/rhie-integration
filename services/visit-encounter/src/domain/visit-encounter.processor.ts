import type { RhieConfig, VisitEncounterConfig } from '@rhie/config';
import type { Logger } from '@rhie/logger';
import {
  RhieAuthProvider,
  uploadVisitEncounterOnce,
  type VisitEncounterUploadResult,
} from '@rhie/rhie-client';
import axios, { type AxiosInstance } from 'axios';
import { rhieSanitizeUpid, rhieUpidIsExcluded } from '@rhie/shared';
import type { BatchResult } from '@rhie/worker-framework';
import { VisitEncounterRepository } from '../repository/visit-encounter.repository.js';
import {
  VisitPayloadBuilder,
  serializeETransferPayload,
  serializeVisitPayload,
} from './visit-payload.builder.js';
import type { ETransferEncounterDataRow, FhirETransferEncounterPayload, FhirVisitEncounterPayload, VisitEncounterDataRow, VisitUploadResult } from './types.js';

export interface VisitEncounterProcessorDeps {
  repository: VisitEncounterRepository;
  payloadBuilder: VisitPayloadBuilder;
  logger: Logger;
  config: VisitEncounterConfig;
  rhieConfig: RhieConfig;
  facilityId?: string;
  facilityCode?: string;
  now?: () => Date;
  /** Override for unit tests; defaults to uploadVisitEncounterOnce. */
  uploadVisitEncounter?: typeof uploadVisitEncounterOnce;
}

export type VisitEncounterService = VisitEncounterProcessor;

export class VisitEncounterProcessor {
  private readonly http: AxiosInstance;
  private readonly authProvider: RhieAuthProvider;
  private readonly now: () => Date;

  constructor(private readonly deps: VisitEncounterProcessorDeps) {
    this.now = deps.now ?? (() => new Date());
    this.http = axios.create({
      baseURL: deps.rhieConfig.baseUrl,
      timeout: deps.rhieConfig.timeoutMs,
      auth: {
        username: deps.rhieConfig.auth.username ?? '',
        password: deps.rhieConfig.auth.password ?? '',
      },
    });

    this.authProvider = new RhieAuthProvider(
      deps.rhieConfig.auth,
      deps.logger,
      this.http,
    );
  }

  async processPendingVisitEncounters(batchSize: number): Promise<BatchResult> {
    return this.processPendingBatch(
      batchSize,
      (limit) => this.deps.repository.findPendingVisitEncounters(limit),
      (clientId, date) => this.upload(clientId, date, 'VISIT_ENCOUNTER'),
      'visit_encounter',
    );
  }

  async processPendingETransferEncounters(batchSize: number): Promise<BatchResult> {
    return this.processPendingBatch(
      batchSize,
      (limit) => this.deps.repository.findPendingETransferEncounters(limit),
      (clientId, date) => this.upload(clientId, date, 'E_TRANSFER'),
      'e_transfer',
    );
  }

  /** Run visit uploads first, then E_TRANSFER (parent visit must be rhie_status=1 for fetch SQL). */
  async processAllPendingEncounters(batchSize: number): Promise<BatchResult> {
    const visit = await this.processPendingVisitEncounters(batchSize);
    const transfer = await this.processPendingETransferEncounters(batchSize);
    return {
      processed: visit.processed + transfer.processed,
      failed: visit.failed + transfer.failed,
      skipped: visit.skipped + transfer.skipped,
    };
  }

  private async processPendingBatch(
    batchSize: number,
    findPending: (limit: number) => Promise<Array<{ client_id: number; date: string }>>,
    uploadFn: (clientId: number, date: string) => Promise<VisitUploadResult[]>,
    eventPrefix: string,
  ): Promise<BatchResult> {
    const rows = await findPending(batchSize);

    this.deps.logger.debug(
      { event: `${eventPrefix}_poll_records`, pendingEncounters: rows.length, batchSize },
      `Found ${rows.length} pending encounters`,
    );

    if (rows.length === 0) {
      return { processed: 0, failed: 0, skipped: 0 };
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        const results = await uploadFn(row.client_id, row.date);

        // PHP batch echoes "success" even when upload returns [] (e.g. missing parent visit).
        if (results.length === 0) {
          skipped += 1;
        } else {
          processed += 1;
        }
      } catch (error) {
        failed += 1;
        this.deps.logger.error(
          {
            event: `${eventPrefix}_upload_error`,
            clientId: row.client_id,
            date: row.date,
            facilityId: this.deps.facilityId,
            error: error instanceof Error ? error.message : String(error),
          },
          `Upload error for client ${row.client_id}`,
        );
      }
    }

    return { processed, failed, skipped };
  }

  /**
   * Port of UploadVisitEncounterController::upload() for VISIT_ENCOUNTER and E_TRANSFER.
   */
  async upload(
    clientId: number,
    date: string,
    type: 'VISIT_ENCOUNTER' | 'E_TRANSFER' | 'CONSULTATION_ENCOUNTER',
  ): Promise<VisitUploadResult[]> {
    if (type === 'CONSULTATION_ENCOUNTER') {
      throw new Error(`Unsupported encounter type: ${type}`);
    }

    this.deps.logger.debug(
      {
        event: 'encounter_upload_start',
        clientId,
        date,
        type,
        facilityId: this.deps.facilityId,
      },
      `Encounter upload: client=${clientId} date=${date} type=${type}`,
    );

    const visits =
      type === 'VISIT_ENCOUNTER'
        ? await this.deps.repository.getVisitEncounterData(date, clientId)
        : await this.deps.repository.getETransferEncounterData(date, clientId);

    // PHP: empty $visits when parent VISIT_ENCOUNTER missing or rhie_status != 1 — no throw, no mark.
    if (visits.length === 0) {
      this.deps.logger.debug(
        {
          event: 'encounter_upload_no_rows',
          clientId,
          date,
          type,
        },
        'No encounter rows returned from fetch SQL — upload skipped',
      );
      return [];
    }

    const results: VisitUploadResult[] = [];

    for (const visit of visits) {
      const upid = rhieSanitizeUpid(visit.upid ?? null);
      visit.upid = upid ?? visit.upid;

      if (rhieUpidIsExcluded(upid)) {
        continue;
      }

      if (type === 'E_TRANSFER') {
        results.push(
          await this.uploadETransferRow(visit as ETransferEncounterDataRow, clientId, date),
        );
      } else {
        results.push(await this.uploadVisitRow(visit as VisitEncounterDataRow, clientId, date));
      }
    }

    return results;
  }

  private async uploadVisitRow(
    visit: VisitEncounterDataRow,
    clientId: number,
    date: string,
  ): Promise<VisitUploadResult> {
    const payload = this.deps.payloadBuilder.build(visit);

    if (this.deps.config.executionMode === 'shadow') {
      this.deps.logger.info(
        {
          event: 'shadow_payload_built',
          clientId,
          date,
          type: 'VISIT_ENCOUNTER',
          encountId: visit.resource_encount_id,
          payload: serializeVisitPayload(payload),
        },
        'Shadow mode — visit encounter upload skipped',
      );

      return {
        endpoint: this.deps.rhieConfig.visitEncounterPath,
        kind: 'visit',
        encounter_id: payload.id,
        upid: payload.subject.identifier.value,
        response: { shadow: true },
      };
    }

    const uploadResult = await this.sendToHie(payload, 'visit');
    await this.deps.repository.markVisitUploaded(visit.resource_encount_id);
    return this.toPhpResult(uploadResult);
  }

  private async uploadETransferRow(
    visit: ETransferEncounterDataRow,
    clientId: number,
    date: string,
  ): Promise<VisitUploadResult> {
    const payload = this.deps.payloadBuilder.buildRef(visit, this.now);

    if (this.deps.config.executionMode === 'shadow') {
      this.deps.logger.info(
        {
          event: 'shadow_payload_built',
          clientId,
          date,
          type: 'E_TRANSFER',
          encountId: visit.resource_encount_id,
          referenceEncountId: visit.reference_encount_id,
          payload: serializeETransferPayload(payload),
        },
        'Shadow mode — E_TRANSFER upload skipped',
      );

      return {
        endpoint: this.deps.rhieConfig.visitEncounterPath,
        kind: 'referral',
        encounter_id: payload.id,
        upid: payload.subject.identifier.value,
        response: { shadow: true },
      };
    }

    const uploadResult = await this.sendToHie(payload, 'referral');
    await this.deps.repository.markVisitUploaded(visit.resource_encount_id);
    return this.toPhpResult(uploadResult);
  }

  private async sendToHie(
    payload: FhirVisitEncounterPayload | FhirETransferEncounterPayload,
    kind: 'visit' | 'referral',
  ): Promise<VisitEncounterUploadResult> {
    const upload =
      this.deps.uploadVisitEncounter ?? uploadVisitEncounterOnce;
    return upload(
      this.http,
      this.authProvider,
      this.deps.rhieConfig,
      payload as unknown as Record<string, unknown>,
      kind,
      this.deps.logger,
    );
  }

  private toPhpResult(result: VisitEncounterUploadResult): VisitUploadResult {
    return {
      endpoint: result.endpoint,
      kind: result.kind,
      encounter_id: result.encounterId,
      upid: result.upid,
      http_code: result.httpCode,
      response: result.data,
    };
  }
}
