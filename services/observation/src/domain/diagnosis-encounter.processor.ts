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
import { DiagnosisEncounterRepository } from '../repository/diagnosis-encounter.repository.js';
import {
  DiagnosisPayloadBuilder,
  DIAGNOSIS_DISPLAY,
  serializeDiagnosisPayload,
} from './diagnosis-payload.builder.js';
import type { DiagnosisUploadResult } from './types.js';
import type { UploadShrResourceFn } from './complaint-encounter.processor.js';

export interface DiagnosisEncounterProcessorDeps {
  repository: DiagnosisEncounterRepository;
  payloadBuilder: DiagnosisPayloadBuilder;
  logger: Logger;
  config: ObservationConfig;
  rhieConfig: RhieConfig;
  facilityId?: string;
  facilityCode?: string;
  uploadShrResource?: UploadShrResourceFn;
}

/** Business logic port of PHP UploadEncounterController diagnostic upload path */
export type DiagnosisEncounterService = DiagnosisEncounterProcessor;

export class DiagnosisEncounterProcessor {
  private readonly http: AxiosInstance;
  private readonly authProvider: RhieAuthProvider;

  constructor(private readonly deps: DiagnosisEncounterProcessorDeps) {
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

  async processPendingDiagnosisEncounters(batchSize: number): Promise<BatchResult> {
    const rows = await this.deps.repository.findPendingDiagnosisEncounters(batchSize);

    this.deps.logger.debug(
      { event: 'poll_records', pendingDiagnoses: rows.length, batchSize },
      `Found ${rows.length} pending diagnosis encounters`,
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
        const outcome = await this.uploadDiagnoses(row.client_id, row.date);
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
            event: 'diagnosis_upload_error',
            clientId: row.client_id,
            date: row.date,
            facilityId: this.deps.facilityId,
            error: error instanceof Error ? error.message : String(error),
          },
          `Diagnosis upload error for client ${row.client_id}`,
        );
      }
    }

    return { processed, failed, skipped };
  }

  /**
   * Port of UploadEncounterController::uploadObservations() diagnostic branch.
   */
  async uploadDiagnoses(
    clientId: number,
    date: string,
  ): Promise<{ uploaded: number; attempted: number; results: DiagnosisUploadResult[] }> {
    this.deps.logger.debug(
      {
        event: 'diagnosis_upload_start',
        clientId,
        date,
        facilityId: this.deps.facilityId,
      },
      `Diagnosis upload: client=${clientId} date=${date}`,
    );

    const observations = await this.deps.repository.getDiagnosisEncounterData(date, clientId);
    const results: DiagnosisUploadResult[] = [];
    let uploaded = 0;
    let attempted = 0;

    for (const observation of observations) {
      const upid = rhieSanitizeUpid(observation.upid ?? null);
      observation.upid = upid ?? observation.upid;

      if (rhieUpidIsExcluded(upid)) {
        continue;
      }

      if (observation.display !== DIAGNOSIS_DISPLAY) {
        continue;
      }

      attempted += 1;
      const payload = this.deps.payloadBuilder.build(observation);

      if (this.deps.config.executionMode === 'shadow') {
        this.deps.logger.info(
          {
            event: 'shadow_payload_built',
            clientId,
            date,
            encountId: observation.observation_encount_id,
            payload: serializeDiagnosisPayload(payload),
          },
          'Shadow mode — diagnosis condition upload skipped',
        );

        results.push({
          success: true,
          resourceType: 'Condition',
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
        'Condition',
        payload as unknown as Record<string, unknown>,
        this.deps.logger,
      );

      const result: DiagnosisUploadResult = {
        success: uploadResult.success,
        resourceType: 'Condition',
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
            event: 'diagnosis_marked_uploaded',
            encountId: observation.observation_encount_id,
            httpCode: uploadResult.httpCode,
          },
          'Diagnosis condition marked uploaded',
        );
      } else {
        this.deps.logger.error(
          {
            event: 'diagnosis_upload_failed',
            encountId: observation.observation_encount_id,
            httpCode: uploadResult.httpCode,
            response: uploadResult.data,
          },
          'Diagnosis condition upload failed',
        );
      }
    }

    return { uploaded, attempted, results };
  }
}
