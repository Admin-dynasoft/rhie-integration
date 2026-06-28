import type { ClientRegistryConfig, RhieConfig } from '@rhie/config';
import type { Logger } from '@rhie/logger';
import { uploadClientRegistryOnce, RhieAuthProvider } from '@rhie/rhie-client';
import axios, { type AxiosInstance } from 'axios';
import { rhieSanitizeUpid, rhieUpidIsExcluded } from '@rhie/shared';
import type { BatchResult } from '@rhie/worker-framework';
import { ClientRegistryRepository } from '../repository/client-registry.repository.js';
import { PatientPayloadBuilder, serializePatientPayload } from './patient-payload.builder.js';
import type { UpidProcessLogEntry } from './types.js';

export interface ClientRegistryProcessorDeps {
  repository: ClientRegistryRepository;
  payloadBuilder: PatientPayloadBuilder;
  logger: Logger;
  config: ClientRegistryConfig;
  rhieConfig: RhieConfig;
}

export class ClientRegistryProcessor {
  private readonly http: AxiosInstance;
  private readonly authProvider: RhieAuthProvider;

  constructor(private readonly deps: ClientRegistryProcessorDeps) {
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

  async processPendingClients(batchSize: number): Promise<BatchResult> {
    const limit = Math.min(batchSize, this.deps.config.maxClientsPerBatch);
    const clientIds = await this.deps.repository.findPendingClientIds(limit);

    this.deps.logger.debug(
      { event: 'poll_records', pendingClients: clientIds.length, limit },
      `Found ${clientIds.length} pending clients`,
    );

    if (clientIds.length === 0) {
      return { processed: 0, failed: 0, skipped: 0 };
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    for (const clientId of clientIds) {
      try {
        const result = await this.processClient(clientId);
        processed += result.processed;
        failed += result.failed;
        skipped += result.skipped;
      } catch (error) {
        this.deps.logger.error(
          {
            event: 'client_processing_error',
            clientId,
            error: error instanceof Error ? error.message : String(error),
          },
          `Unhandled error processing client ${clientId}`,
        );
        try {
          await this.deps.repository.markClientAsFailed(clientId);
          this.deps.logger.warn(
            { event: 'client_marked_failed', clientId },
            `Marked all UPIDs failed for client ${clientId}`,
          );
        } catch (markError) {
          this.deps.logger.warn(
            { event: 'mark_client_failed_error', clientId },
            'Failed to update client status after error',
          );
        }
        failed += 1;
      }
    }

    return { processed, failed, skipped };
  }

  private async processClient(
    clientId: number,
  ): Promise<{ processed: number; failed: number; skipped: number }> {
    const upids = await this.deps.repository.getUpidsByClient(clientId);

    if (upids.length === 0) {
      this.deps.logger.debug(
        { event: 'no_upids', clientId },
        `No UPIDs found for client ${clientId}`,
      );
      return { processed: 0, failed: 0, skipped: 0 };
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    for (const rawUpid of upids) {
      const result = await this.processUpid(rawUpid, clientId);
      if (result === 'processed') processed += 1;
      else if (result === 'failed') failed += 1;
      else skipped += 1;
    }

    return { processed, failed, skipped };
  }

  private async processUpid(
    rawUpid: string,
    clientId: number,
  ): Promise<'processed' | 'failed' | 'skipped'> {
    const upid = rhieSanitizeUpid(rawUpid) ?? '';

    if (upid === '' || rhieUpidIsExcluded(upid)) {
      return 'skipped';
    }

    const entry: UpidProcessLogEntry = { clientId, upid, steps: [] };

    this.deps.logger.debug(
      { event: 'upid_processing_start', upid, clientId },
      `Processing UPID ${upid}`,
    );

    const data = await this.deps.repository.getClientDataByUpid(upid);

    if (!data) {
      entry.steps.push({
        step: 'fetch_local_data',
        success: false,
        message: 'No local data found',
      });

      if (this.deps.config.executionMode === 'production') {
        await this.deps.repository.updateUpidStatus(upid, 3);
        this.deps.logger.debug({ event: 'status_updated', upid, status: 3 }, 'UPID marked failed');
      } else {
        this.deps.logger.info(
          { event: 'shadow_skip_status_update', upid, wouldSetStatus: 3 },
          'Shadow mode — skipped status update',
        );
      }

      this.logEntry(entry);
      return 'failed';
    }

    entry.steps.push({ step: 'fetch_local_data', success: true });

    const payload = this.deps.payloadBuilder.build(data);
    const serialized = serializePatientPayload(payload);

    entry.steps.push({
      step: 'build_patient_payload',
      payload,
    });

    if (this.deps.config.executionMode === 'shadow') {
      this.deps.logger.info(
        {
          event: 'shadow_payload_built',
          upid,
          clientId,
          payload: serialized,
        },
        'Shadow mode — payload built, upload skipped',
      );
      entry.steps.push({
        step: 'send_to_hie',
        success: true,
        shadow: true,
        message: 'Shadow mode — upload skipped',
      });
      this.logEntry(entry);
      return 'processed';
    }

    const result = await uploadClientRegistryOnce(
      this.http,
      this.authProvider,
      this.deps.rhieConfig,
      payload,
      this.deps.logger,
    );

    entry.steps.push({
      step: 'send_to_hie',
      success: result.success,
      http_status: result.statusCode ?? null,
      response: result.data ?? result.error,
    });

    if (result.success) {
      await this.deps.repository.updateUpidStatus(upid, 2);
      this.deps.logger.info(
        { event: 'upload_success', upid, httpStatus: result.statusCode },
        `UPID ${upid} uploaded successfully`,
      );
      this.logEntry(entry);
      return 'processed';
    }

    await this.deps.repository.updateUpidStatus(upid, 3);
    this.deps.logger.error(
      { event: 'upload_failed', upid, httpStatus: result.statusCode, error: result.error },
      `UPID ${upid} upload failed`,
    );
    this.logEntry(entry);
    return 'failed';
  }

  private logEntry(entry: UpidProcessLogEntry): void {
    this.deps.logger.debug({ event: 'upid_process_log', ...entry }, 'UPID process log');
  }
}
