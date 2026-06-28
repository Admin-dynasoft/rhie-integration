import type { IntegrationStateConfig } from '@rhie/config';
import type { DatabaseConnection } from '@rhie/database';
import type { Logger } from '@rhie/logger';
import { buildIdempotencyKey } from '../idempotency.js';
import { IntegrationStateRepository } from '../repository/integration-state.repository.js';
import type {
  CreateIntegrationStateInput,
  IntegrationStateRecord,
  IntegrationUploadStatus,
} from '../types.js';

export interface IntegrationStateStoreOptions {
  db: DatabaseConnection;
  config: IntegrationStateConfig;
  logger?: Logger;
}

export class IntegrationStateStore {
  private readonly repository: IntegrationStateRepository;
  private schemaReady = false;

  constructor(private readonly options: IntegrationStateStoreOptions) {
    this.repository = new IntegrationStateRepository(options.db);
  }

  buildIdempotencyKey(input: Omit<CreateIntegrationStateInput, 'idempotencyKey'>): string {
    return buildIdempotencyKey({
      facilityCode: input.facilityCode,
      pipelineStage: input.pipelineStage,
      entityType: input.entityType,
      entityKey: input.entityKey,
    });
  }

  async ensureReady(): Promise<void> {
    if (this.schemaReady || !this.options.config.autoMigrate) {
      this.schemaReady = true;
      return;
    }

    await this.repository.ensureSchema();
    this.schemaReady = true;
    this.options.logger?.info(
      { event: 'integration_state_schema_ready' },
      'Integration state schema ensured',
    );
  }

  async findByIdempotencyKey(key: string): Promise<IntegrationStateRecord | null> {
    await this.ensureReady();
    return this.repository.findByIdempotencyKey(key);
  }

  async getOrCreatePending(input: CreateIntegrationStateInput): Promise<IntegrationStateRecord> {
    await this.ensureReady();

    const idempotencyKey =
      input.idempotencyKey ??
      this.buildIdempotencyKey(input);

    await this.repository.upsertPending({ ...input, idempotencyKey });

    const record = await this.repository.findByIdempotencyKey(idempotencyKey);
    if (!record) {
      throw new Error(`Failed to load integration state for key ${idempotencyKey}`);
    }

    if (record.status === 'pending') {
      await this.recordHistory(record.id, 'created', 'pending', 'Integration state record created');
    }

    return record;
  }

  async shouldProcess(idempotencyKey: string): Promise<boolean> {
    const record = await this.findByIdempotencyKey(idempotencyKey);
    if (!record) {
      return true;
    }
    return record.status === 'pending' || record.status === 'failed';
  }

  async beginProcessing(idempotencyKey: string): Promise<boolean> {
    await this.ensureReady();
    const started = await this.repository.markProcessing(idempotencyKey);
    if (started) {
      const stateId = await this.repository.getStateId(idempotencyKey);
      if (stateId) {
        await this.recordHistory(stateId, 'processing_started', 'processing');
      }
    }
    return started;
  }

  async recordSuccess(
    idempotencyKey: string,
    rhieResourceId: string | null,
    rhieResourceType?: string,
  ): Promise<void> {
    await this.ensureReady();
    await this.repository.markSuccess(idempotencyKey, rhieResourceId);

    const stateId = await this.repository.getStateId(idempotencyKey);
    if (stateId) {
      await this.recordHistory(stateId, 'upload_success', 'success', undefined, {
        rhieResourceId,
        rhieResourceType,
      });
    }
  }

  async recordFailure(idempotencyKey: string, errorMessage: string): Promise<IntegrationStateRecord | null> {
    await this.ensureReady();
    await this.repository.markFailed(idempotencyKey, errorMessage);

    const record = await this.repository.findByIdempotencyKey(idempotencyKey);
    if (record) {
      await this.recordHistory(record.id, 'upload_failed', 'failed', errorMessage);

      if (record.retryCount >= this.options.config.deadLetterAfterRetries) {
        await this.moveToDeadLetter(idempotencyKey, `Exceeded ${this.options.config.deadLetterAfterRetries} retries`);
      }
    }

    return record;
  }

  async moveToDeadLetter(
    idempotencyKey: string,
    reason: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.ensureReady();

    const record = await this.repository.findByIdempotencyKey(idempotencyKey);
    if (!record) {
      return;
    }

    await this.repository.markDeadLetter(idempotencyKey, reason);
    await this.repository.insertDeadLetter(
      record.id,
      record.facilityCode,
      record.pipelineStage,
      idempotencyKey,
      reason,
      payload ?? null,
    );
    await this.recordHistory(record.id, 'dead_lettered', 'dead_letter', reason, payload);
  }

  isTerminalStatus(status: IntegrationUploadStatus): boolean {
    return status === 'success' || status === 'dead_letter';
  }

  private async recordHistory(
    integrationStateId: number,
    eventType: string,
    status: string,
    message?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.repository.appendHistory({
      integrationStateId,
      eventType,
      status,
      message,
      metadata,
    });
  }
}
