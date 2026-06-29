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
import { MedicationEncounterRepository } from '../repository/medication-encounter.repository.js';
import {
  MedicationPayloadBuilder,
  MEDICATION_REQUEST_DISPLAY,
  serializeMedicationPayload,
} from './medication-payload.builder.js';
import type { MedicationUploadResult } from './types.js';
import type { UploadShrResourceFn } from './complaint-encounter.processor.js';

export interface MedicationEncounterProcessorDeps {
  repository: MedicationEncounterRepository;
  payloadBuilder: MedicationPayloadBuilder;
  logger: Logger;
  config: ObservationConfig;
  rhieConfig: RhieConfig;
  facilityId?: string;
  facilityCode?: string;
  uploadShrResource?: UploadShrResourceFn;
}

/** Business logic port of PHP UploadEncounterController medication request upload path */
export type MedicationEncounterService = MedicationEncounterProcessor;

export class MedicationEncounterProcessor {
  private readonly http: AxiosInstance;
  private readonly authProvider: RhieAuthProvider;

  constructor(private readonly deps: MedicationEncounterProcessorDeps) {
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

  async processPendingMedicationEncounters(batchSize: number): Promise<BatchResult> {
    const rows = await this.deps.repository.findPendingMedicationEncounters(batchSize);

    this.deps.logger.debug(
      { event: 'poll_records', pendingMedications: rows.length, batchSize },
      `Found ${rows.length} pending medication encounters`,
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
        const outcome = await this.uploadMedications(row.client_id, row.date);
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
            event: 'medication_upload_error',
            clientId: row.client_id,
            date: row.date,
            facilityId: this.deps.facilityId,
            error: error instanceof Error ? error.message : String(error),
          },
          `Medication upload error for client ${row.client_id}`,
        );
      }
    }

    return { processed, failed, skipped };
  }

  /**
   * Port of UploadEncounterController::uploadObservations() Medication_Request branch.
   */
  async uploadMedications(
    clientId: number,
    date: string,
  ): Promise<{ uploaded: number; attempted: number; results: MedicationUploadResult[] }> {
    this.deps.logger.debug(
      {
        event: 'medication_upload_start',
        clientId,
        date,
        facilityId: this.deps.facilityId,
      },
      `Medication upload: client=${clientId} date=${date}`,
    );

    const observations = await this.deps.repository.getMedicationEncounterData(date, clientId);
    const results: MedicationUploadResult[] = [];
    let uploaded = 0;
    let attempted = 0;

    for (const observation of observations) {
      const upid = rhieSanitizeUpid(observation.upid ?? null);
      observation.upid = upid ?? observation.upid;

      if (rhieUpidIsExcluded(upid)) {
        continue;
      }

      if (observation.display !== MEDICATION_REQUEST_DISPLAY) {
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
            payload: serializeMedicationPayload(payload),
          },
          'Shadow mode — medication request upload skipped',
        );

        results.push({
          success: true,
          resourceType: 'MedicationRequest',
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
        'MedicationRequest',
        payload,
        this.deps.logger,
      );

      const result: MedicationUploadResult = {
        success: uploadResult.success,
        resourceType: 'MedicationRequest',
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
            event: 'medication_marked_uploaded',
            encountId: observation.observation_encount_id,
            httpCode: uploadResult.httpCode,
          },
          'Medication request marked uploaded',
        );
      } else {
        this.deps.logger.error(
          {
            event: 'medication_upload_failed',
            encountId: observation.observation_encount_id,
            httpCode: uploadResult.httpCode,
            response: uploadResult.data,
          },
          'Medication request upload failed',
        );
      }
    }

    return { uploaded, attempted, results };
  }
}
