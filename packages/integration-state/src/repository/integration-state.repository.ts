import type { RowDataPacket, DatabaseConnection } from '@rhie/database';
import {
  SCHEMA_STATEMENTS,
  SQL_FIND_BY_IDEMPOTENCY_KEY,
  SQL_UPSERT_PENDING,
  SQL_MARK_PROCESSING,
  SQL_MARK_SUCCESS,
  SQL_MARK_FAILED,
  SQL_MARK_DEAD_LETTER,
  SQL_INSERT_HISTORY,
  SQL_INSERT_DEAD_LETTER,
  SQL_FIND_BY_ID,
} from '../schema/sql.js';
import type {
  IntegrationStateRecord,
  CreateIntegrationStateInput,
  AppendHistoryInput,
} from '../types.js';

function mapRow(row: RowDataPacket): IntegrationStateRecord {
  return {
    id: Number(row.id),
    facilityCode: String(row.facilityCode),
    pipelineStage: String(row.pipelineStage),
    entityType: String(row.entityType),
    entityKey: String(row.entityKey),
    idempotencyKey: String(row.idempotencyKey),
    status: row.status as IntegrationStateRecord['status'],
    retryCount: Number(row.retryCount),
    rhieResourceId: row.rhieResourceId != null ? String(row.rhieResourceId) : null,
    rhieResourceType: row.rhieResourceType != null ? String(row.rhieResourceType) : null,
    lastErrorMessage: row.lastErrorMessage != null ? String(row.lastErrorMessage) : null,
    lastAttemptAt: row.lastAttemptAt ? new Date(row.lastAttemptAt as string) : null,
    lastSuccessAt: row.lastSuccessAt ? new Date(row.lastSuccessAt as string) : null,
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
  };
}

export class IntegrationStateRepository {
  constructor(private readonly db: DatabaseConnection) {}

  async ensureSchema(): Promise<void> {
    for (const statement of SCHEMA_STATEMENTS) {
      await this.db.execute(statement);
    }
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<IntegrationStateRecord | null> {
    const rows = await this.db.query<RowDataPacket[]>(SQL_FIND_BY_IDEMPOTENCY_KEY, [idempotencyKey]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async upsertPending(
    input: CreateIntegrationStateInput & { idempotencyKey: string },
  ): Promise<void> {
    await this.db.execute(SQL_UPSERT_PENDING, [
      input.facilityCode,
      input.pipelineStage,
      input.entityType,
      input.entityKey,
      input.idempotencyKey,
      input.rhieResourceType ?? null,
    ]);
  }

  async markProcessing(idempotencyKey: string): Promise<boolean> {
    const result = await this.db.execute(SQL_MARK_PROCESSING, [idempotencyKey]);
    return result.affectedRows > 0;
  }

  async markSuccess(idempotencyKey: string, rhieResourceId: string | null): Promise<void> {
    await this.db.execute(SQL_MARK_SUCCESS, [rhieResourceId, idempotencyKey]);
  }

  async markFailed(idempotencyKey: string, errorMessage: string): Promise<void> {
    await this.db.execute(SQL_MARK_FAILED, [errorMessage, idempotencyKey]);
  }

  async markDeadLetter(idempotencyKey: string, reason: string): Promise<void> {
    await this.db.execute(SQL_MARK_DEAD_LETTER, [reason, idempotencyKey]);
  }

  async appendHistory(input: AppendHistoryInput): Promise<void> {
    const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;
    await this.db.execute(SQL_INSERT_HISTORY, [
      input.integrationStateId,
      input.eventType,
      input.status,
      input.message ?? null,
      metadataJson,
    ]);
  }

  async insertDeadLetter(
    integrationStateId: number,
    facilityCode: string,
    pipelineStage: string,
    idempotencyKey: string,
    reason: string,
    payload: Record<string, unknown> | null,
  ): Promise<void> {
    await this.db.execute(SQL_INSERT_DEAD_LETTER, [
      integrationStateId,
      facilityCode,
      pipelineStage,
      idempotencyKey,
      reason,
      payload ? JSON.stringify(payload) : null,
    ]);
  }

  async getStateId(idempotencyKey: string): Promise<number | null> {
    const rows = await this.db.query<RowDataPacket[]>(SQL_FIND_BY_ID, [idempotencyKey]);
    if (rows.length === 0) {
      return null;
    }
    return Number(rows[0].id);
  }
}
