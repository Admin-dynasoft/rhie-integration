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
import { VisitPayloadBuilder, serializeVisitPayload } from './visit-payload.builder.js';
import type { VisitUploadResult } from './types.js';

export interface VisitEncounterProcessorDeps {
  repository: VisitEncounterRepository;
  payloadBuilder: VisitPayloadBuilder;
  logger: Logger;
  config: VisitEncounterConfig;
  rhieConfig: RhieConfig;
  facilityId?: string;
  facilityCode?: string;
}

/** Service-layer alias — business logic port of PHP UploadVisitEncounterController */
export type VisitEncounterService = VisitEncounterProcessor;
export type VisitEncounterServiceDeps = VisitEncounterProcessorDeps;

export class VisitEncounterProcessor {
  private readonly http: AxiosInstance;
  private readonly authProvider: RhieAuthProvider;

  constructor(private readonly deps: VisitEncounterProcessorDeps) {
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
    const rows = await this.deps.repository.findPendingVisitEncounters(batchSize);

    this.deps.logger.debug(
      { event: 'poll_records', pendingEncounters: rows.length, batchSize },
      `Found ${rows.length} pending visit encounters`,
    );

    if (rows.length === 0) {
      return { processed: 0, failed: 0, skipped: 0 };
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        const results = await this.upload(
          row.client_id,
          row.date,
          'VISIT_ENCOUNTER',
        );

        if (results.length === 0) {
          skipped += 1;
        } else {
          processed += 1;
        }
      } catch (error) {
        failed += 1;
        this.deps.logger.error(
          {
            event: 'visit_upload_error',
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
   * Port of UploadVisitEncounterController::upload() for VISIT_ENCOUNTER type.
   */
  async upload(
    clientId: number,
    date: string,
    type: 'VISIT_ENCOUNTER' | 'E_TRANSFER' | 'CONSULTATION_ENCOUNTER',
  ): Promise<VisitUploadResult[]> {
    if (type !== 'VISIT_ENCOUNTER') {
      throw new Error(`Unsupported encounter type: ${type}`);
    }

    this.deps.logger.debug(
      {
        event: 'visit_upload_start',
        clientId,
        date,
        type,
        facilityId: this.deps.facilityId,
      },
      `VISIT upload: client=${clientId} date=${date}`,
    );

    const visits = await this.deps.repository.getVisitEncounterData(date, clientId);
    const results: VisitUploadResult[] = [];

    for (const visit of visits) {
      const upid = rhieSanitizeUpid(visit.upid ?? null);
      visit.upid = upid ?? visit.upid;

      if (rhieUpidIsExcluded(upid)) {
        continue;
      }

      const payload = this.deps.payloadBuilder.build(visit);

      if (this.deps.config.executionMode === 'shadow') {
        this.deps.logger.info(
          {
            event: 'shadow_payload_built',
            clientId,
            date,
            encountId: visit.resource_encount_id,
            payload: serializeVisitPayload(payload),
          },
          'Shadow mode — visit encounter upload skipped',
        );

        results.push({
          endpoint: this.deps.rhieConfig.visitEncounterPath,
          kind: 'visit',
          encounter_id: payload.id,
          upid: payload.subject.identifier.value,
          response: { shadow: true },
        });
        continue;
      }

      const uploadResult = await this.sendToHie(payload, 'visit');
      results.push(this.toPhpResult(uploadResult));

      // PHP marks uploaded unconditionally after send, regardless of HTTP status.
      await this.deps.repository.markVisitUploaded(visit.resource_encount_id);

      this.deps.logger.debug(
        {
          event: 'visit_marked_uploaded',
          encountId: visit.resource_encount_id,
          httpCode: uploadResult.httpCode,
        },
        'Visit encounter marked uploaded',
      );
    }

    return results;
  }

  private async sendToHie(
    payload: ReturnType<VisitPayloadBuilder['build']>,
    kind: 'visit' | 'referral',
  ): Promise<VisitEncounterUploadResult> {
    return uploadVisitEncounterOnce(
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
