import type { ObservationConfig, RhieConfig } from '@rhie/config';
import type { Logger } from '@rhie/logger';
import {
  RhieAuthProvider,
  uploadShrResourceOnce,
  type ShrResourceUploadResult,
} from '@rhie/rhie-client';
import axios, { type AxiosInstance } from 'axios';
import { rhieSanitizeUpid, rhieUpidIsExcluded } from '@rhie/shared';
import type { BatchResult } from '@rhie/worker-framework';
import { LaboratoryEncounterRepository } from '../repository/laboratory-encounter.repository.js';
import {
  LaboratoryPayloadBuilder,
  LABORATORY_DISPLAY,
  LAB_REQUEST_DISPLAY,
  serializeLabRequestPayload,
  serializeLabResultPayload,
} from './laboratory-payload.builder.js';
import type { LaboratoryUploadResult } from './types.js';
import type { UploadShrResourceFn } from './complaint-encounter.processor.js';

export interface LaboratoryEncounterProcessorDeps {
  repository: LaboratoryEncounterRepository;
  payloadBuilder: LaboratoryPayloadBuilder;
  logger: Logger;
  config: ObservationConfig;
  rhieConfig: RhieConfig;
  facilityId?: string;
  facilityCode?: string;
  uploadShrResource?: UploadShrResourceFn;
}

/** Business logic port of PHP UploadEncounterController laboratory upload paths */
export type LaboratoryEncounterService = LaboratoryEncounterProcessor;

function mergeBatchResults(a: BatchResult, b: BatchResult): BatchResult {
  return {
    processed: a.processed + b.processed,
    failed: a.failed + b.failed,
    skipped: a.skipped + b.skipped,
  };
}

export class LaboratoryEncounterProcessor {
  private readonly http: AxiosInstance;
  private readonly authProvider: RhieAuthProvider;

  constructor(private readonly deps: LaboratoryEncounterProcessorDeps) {
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

  /** Lab results batch — PHP merge order: after complaint, before diagnosis */
  async processPendingLabResultEncounters(batchSize: number): Promise<BatchResult> {
    return this.processPendingBatch(
      batchSize,
      () => this.deps.repository.findPendingLabResultEncounters(batchSize),
      'lab_results',
      (clientId, date) => this.uploadLabResults(clientId, date),
    );
  }

  /** Lab requests batch — PHP merge order: after diagnosis, before medication */
  async processPendingLabRequestEncounters(batchSize: number): Promise<BatchResult> {
    return this.processPendingBatch(
      batchSize,
      () => this.deps.repository.findPendingLabRequestEncounters(batchSize),
      'lab_requests',
      (clientId, date) => this.uploadLabRequests(clientId, date),
    );
  }

  private async processPendingBatch(
    batchSize: number,
    findPending: () => Promise<Array<{ client_id: number; date: string }>>,
    kind: string,
    upload: (clientId: number, date: string) => Promise<{
      uploaded: number;
      attempted: number;
    }>,
  ): Promise<BatchResult> {
    const rows = await findPending();

    this.deps.logger.debug(
      { event: 'poll_records', kind, pending: rows.length, batchSize },
      `Found ${rows.length} pending ${kind} encounters`,
    );

    if (rows.length === 0) {
      return { processed: 0, failed: 0, skipped: 0 };
    }

    const seen = new Set<string>();
    let processed = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of rows) {
      const key = `${row.client_id}_${row.date}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      try {
        const outcome = await upload(row.client_id, row.date);
        if (outcome.uploaded > 0) {
          processed += 1;
        } else if (outcome.attempted === 0) {
          skipped += 1;
        } else {
          failed += 1;
        }
      } catch (error) {
        failed += 1;
        this.deps.logger.error(
          {
            event: 'laboratory_upload_error',
            kind,
            clientId: row.client_id,
            date: row.date,
            facilityId: this.deps.facilityId,
            error: error instanceof Error ? error.message : String(error),
          },
          `Laboratory ${kind} upload error for client ${row.client_id}`,
        );
      }
    }

    return { processed, failed, skipped };
  }

  /**
   * Port of UploadEncounterController::uploadObservations() Laboratory branch.
   */
  async uploadLabResults(
    clientId: number,
    date: string,
  ): Promise<{ uploaded: number; attempted: number; results: LaboratoryUploadResult[] }> {
    this.deps.logger.debug(
      { event: 'lab_result_upload_start', clientId, date, facilityId: this.deps.facilityId },
      `Lab result upload: client=${clientId} date=${date}`,
    );

    const observations = await this.deps.repository.getLabResultEncounterData(date, clientId);
    return this.uploadRows(
      observations,
      clientId,
      date,
      LABORATORY_DISPLAY,
      (row) => this.deps.payloadBuilder.buildLabResult(row),
      'Observation',
      serializeLabResultPayload,
    );
  }

  /**
   * Port of UploadEncounterController::uploadObservations() Lab Request branch.
   */
  async uploadLabRequests(
    clientId: number,
    date: string,
  ): Promise<{ uploaded: number; attempted: number; results: LaboratoryUploadResult[] }> {
    this.deps.logger.debug(
      { event: 'lab_request_upload_start', clientId, date, facilityId: this.deps.facilityId },
      `Lab request upload: client=${clientId} date=${date}`,
    );

    const observations = await this.deps.repository.getLabRequestEncounterData(date, clientId);
    return this.uploadRows(
      observations,
      clientId,
      date,
      LAB_REQUEST_DISPLAY,
      (row) => this.deps.payloadBuilder.buildLabRequest(row),
      'ServiceRequest',
      serializeLabRequestPayload,
    );
  }

  private async uploadRows<TRow extends { upid: string; display: string; observation_encount_id: string }>(
    observations: TRow[],
    clientId: number,
    date: string,
    expectedDisplay: string,
    buildPayload: (row: TRow) => Record<string, unknown>,
    resourceType: string,
    serialize: (payload: Record<string, unknown>) => Record<string, unknown>,
  ): Promise<{ uploaded: number; attempted: number; results: LaboratoryUploadResult[] }> {
    const results: LaboratoryUploadResult[] = [];
    let uploaded = 0;
    let attempted = 0;

    for (const observation of observations) {
      const upid = rhieSanitizeUpid(observation.upid ?? null);
      observation.upid = upid ?? observation.upid;

      if (rhieUpidIsExcluded(upid)) {
        continue;
      }

      if (observation.display !== expectedDisplay) {
        continue;
      }

      attempted += 1;
      const payload = buildPayload(observation);

      if (this.deps.config.executionMode === 'shadow') {
        this.deps.logger.info(
          {
            event: 'shadow_payload_built',
            clientId,
            date,
            encountId: observation.observation_encount_id,
            resourceType,
            payload: serialize(payload),
          },
          `Shadow mode — ${resourceType} laboratory upload skipped`,
        );

        results.push({
          success: true,
          resourceType,
          observation_encount_id: observation.observation_encount_id,
          response: { shadow: true },
        });
        uploaded += 1;
        continue;
      }

      const upload = this.deps.uploadShrResource ?? uploadShrResourceOnce;
      const uploadResult: ShrResourceUploadResult = await upload(
        this.http,
        this.authProvider,
        resourceType,
        payload,
        this.deps.logger,
      );

      const result: LaboratoryUploadResult = {
        success: uploadResult.success,
        resourceType,
        observation_encount_id: observation.observation_encount_id,
        http_code: uploadResult.httpCode,
        response: uploadResult.data,
      };
      results.push(result);

      if (uploadResult.success) {
        await this.deps.repository.markObservationUploaded(observation.observation_encount_id);
        uploaded += 1;
        this.deps.logger.debug(
          {
            event: 'laboratory_marked_uploaded',
            resourceType,
            encountId: observation.observation_encount_id,
            httpCode: uploadResult.httpCode,
          },
          'Laboratory encounter marked uploaded',
        );
      } else {
        this.deps.logger.error(
          {
            event: 'laboratory_upload_failed',
            resourceType,
            encountId: observation.observation_encount_id,
            httpCode: uploadResult.httpCode,
            response: uploadResult.data,
          },
          'Laboratory encounter upload failed',
        );
      }
    }

    return { uploaded, attempted, results };
  }
}

export { mergeBatchResults };
