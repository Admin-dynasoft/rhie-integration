import type { ObservationConfig, RhieConfig } from '@rhie/config';
import type { Logger } from '@rhie/logger';
import { RhieAuthProvider, uploadShrResourceOnce } from '@rhie/rhie-client';
import axios, { type AxiosInstance } from 'axios';
import { rhieSanitizeUpid, rhieUpidIsExcluded } from '@rhie/shared';
import type { BatchResult } from '@rhie/worker-framework';
import { ComplaintEncounterRepository } from '../repository/complaint-encounter.repository.js';
import {
  ComplaintPayloadBuilder,
  COMPLAINT_DISPLAY,
  serializeComplaintPayload,
} from './complaint-payload.builder.js';
import type { ComplaintUploadResult } from './types.js';

export interface ComplaintEncounterProcessorDeps {
  repository: ComplaintEncounterRepository;
  payloadBuilder: ComplaintPayloadBuilder;
  logger: Logger;
  config: ObservationConfig;
  rhieConfig: RhieConfig;
  facilityId?: string;
  facilityCode?: string;
}

/** Business logic port of PHP UploadEncounterController complaint upload path */
export type ComplaintEncounterService = ComplaintEncounterProcessor;

export class ComplaintEncounterProcessor {
  private readonly http: AxiosInstance;
  private readonly authProvider: RhieAuthProvider;

  constructor(private readonly deps: ComplaintEncounterProcessorDeps) {
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

  async processPendingComplaintEncounters(batchSize: number): Promise<BatchResult> {
    const rows = await this.deps.repository.findPendingComplaintEncounters(batchSize);

    this.deps.logger.debug(
      { event: 'poll_records', pendingComplaints: rows.length, batchSize },
      `Found ${rows.length} pending complaint encounters`,
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
        const outcome = await this.uploadComplaints(row.client_id, row.date);
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
            event: 'complaint_upload_error',
            clientId: row.client_id,
            date: row.date,
            facilityId: this.deps.facilityId,
            error: error instanceof Error ? error.message : String(error),
          },
          `Complaint upload error for client ${row.client_id}`,
        );
      }
    }

    return { processed, failed, skipped };
  }

  /**
   * Port of UploadEncounterController::uploadObservations() complaint branch.
   */
  async uploadComplaints(
    clientId: number,
    date: string,
  ): Promise<{ uploaded: number; attempted: number; results: ComplaintUploadResult[] }> {
    this.deps.logger.debug(
      {
        event: 'complaint_upload_start',
        clientId,
        date,
        facilityId: this.deps.facilityId,
      },
      `Complaint upload: client=${clientId} date=${date}`,
    );

    const observations = await this.deps.repository.getComplaintEncounterData(date, clientId);
    const results: ComplaintUploadResult[] = [];
    let uploaded = 0;
    let attempted = 0;

    for (const observation of observations) {
      const upid = rhieSanitizeUpid(observation.upid ?? null);
      observation.upid = upid ?? observation.upid;

      if (rhieUpidIsExcluded(upid)) {
        continue;
      }

      if (observation.display !== COMPLAINT_DISPLAY) {
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
            payload: serializeComplaintPayload(payload),
          },
          'Shadow mode — complaint observation upload skipped',
        );

        results.push({
          success: true,
          resourceType: 'Observation',
          observation_encount_id: observation.observation_encount_id,
          response: { shadow: true },
        });
        uploaded += 1;
        continue;
      }

      const uploadResult = await uploadShrResourceOnce(
        this.http,
        this.authProvider,
        'Observation',
        payload as unknown as Record<string, unknown>,
        this.deps.logger,
      );

      const result: ComplaintUploadResult = {
        success: uploadResult.success,
        resourceType: 'Observation',
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
            event: 'complaint_marked_uploaded',
            encountId: observation.observation_encount_id,
            httpCode: uploadResult.httpCode,
          },
          'Complaint observation marked uploaded',
        );
      } else {
        this.deps.logger.error(
          {
            event: 'complaint_upload_failed',
            encountId: observation.observation_encount_id,
            httpCode: uploadResult.httpCode,
            response: uploadResult.data,
          },
          'Complaint observation upload failed',
        );
      }
    }

    return { uploaded, attempted, results };
  }
}
