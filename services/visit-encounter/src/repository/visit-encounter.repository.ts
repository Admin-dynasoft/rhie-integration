import type { DatabaseConnection } from '@rhie/database';
import type {
  BatchSelectionDiagnostics,
  ETransferEncounterDataRow,
  PendingVisitEncounterRow,
  VisitEncounterDataRow,
} from '../domain/types.js';
import {
  SQL_FIND_PENDING_E_TRANSFER_ENCOUNTERS,
  SQL_FIND_PENDING_VISIT_ENCOUNTERS,
  SQL_GET_E_TRANSFER_ENCOUNTER_DATA,
  SQL_GET_VISIT_ENCOUNTER_DATA,
  SQL_MARK_VISIT_UPLOADED,
} from './sql.js';
import {
  SQL_DIAG_E_TRANSFER_BATCH_ELIGIBLE_COUNT,
  SQL_DIAG_E_TRANSFER_BLOCKED_UPID_STATUS,
  SQL_DIAG_E_TRANSFER_RHIE_STATUS_2_COUNT,
  SQL_DIAG_VISIT_BATCH_ELIGIBLE_COUNT,
  SQL_DIAG_VISIT_BLOCKED_AGE,
  SQL_DIAG_VISIT_BLOCKED_DOCUMENT_NUMBER,
  SQL_DIAG_VISIT_BLOCKED_UPID_PREFIX,
  SQL_DIAG_VISIT_BLOCKED_UPID_STATUS,
  SQL_DIAG_VISIT_RHIE_STATUS_2_COUNT,
} from './sql.diagnostics.js';

async function readCount(db: DatabaseConnection, sql: string): Promise<number> {
  const [rows] = await db.query(sql);
  const row = (rows as Array<{ count: number }>)[0];
  return Number(row?.count ?? 0);
}

export class VisitEncounterRepository {
  constructor(private readonly db: DatabaseConnection) {}

  async findPendingVisitEncounters(limit: number): Promise<PendingVisitEncounterRow[]> {
    const [rows] = await this.db.query(SQL_FIND_PENDING_VISIT_ENCOUNTERS, [limit]);
    return rows as PendingVisitEncounterRow[];
  }

  async findPendingETransferEncounters(limit: number): Promise<PendingVisitEncounterRow[]> {
    const [rows] = await this.db.query(SQL_FIND_PENDING_E_TRANSFER_ENCOUNTERS, [limit]);
    return rows as PendingVisitEncounterRow[];
  }

  /** DEBUG only — explains batch SQL exclusions without changing selection logic. */
  async getVisitBatchSelectionDiagnostics(): Promise<BatchSelectionDiagnostics> {
    return {
      encounterType: 'VISIT_ENCOUNTER',
      rhieStatus2Count: await readCount(this.db, SQL_DIAG_VISIT_RHIE_STATUS_2_COUNT),
      batchEligibleCount: await readCount(this.db, SQL_DIAG_VISIT_BATCH_ELIGIBLE_COUNT),
      blockedByUpidStatus: await readCount(this.db, SQL_DIAG_VISIT_BLOCKED_UPID_STATUS),
      blockedByUpidPrefix: await readCount(this.db, SQL_DIAG_VISIT_BLOCKED_UPID_PREFIX),
      blockedByAge: await readCount(this.db, SQL_DIAG_VISIT_BLOCKED_AGE),
      blockedByDocumentNumber: await readCount(this.db, SQL_DIAG_VISIT_BLOCKED_DOCUMENT_NUMBER),
    };
  }

  /** DEBUG only — explains batch SQL exclusions without changing selection logic. */
  async getETransferBatchSelectionDiagnostics(): Promise<BatchSelectionDiagnostics> {
    return {
      encounterType: 'E_TRANSFER',
      rhieStatus2Count: await readCount(this.db, SQL_DIAG_E_TRANSFER_RHIE_STATUS_2_COUNT),
      batchEligibleCount: await readCount(this.db, SQL_DIAG_E_TRANSFER_BATCH_ELIGIBLE_COUNT),
      blockedByUpidStatus: await readCount(this.db, SQL_DIAG_E_TRANSFER_BLOCKED_UPID_STATUS),
      blockedByUpidPrefix: 0,
      blockedByAge: 0,
      blockedByDocumentNumber: 0,
    };
  }

  async getVisitEncounterData(date: string, clientId: number): Promise<VisitEncounterDataRow[]> {
    const [rows] = await this.db.query(SQL_GET_VISIT_ENCOUNTER_DATA, [date, clientId]);
    return rows as VisitEncounterDataRow[];
  }

  async getETransferEncounterData(
    date: string,
    clientId: number,
  ): Promise<ETransferEncounterDataRow[]> {
    const [rows] = await this.db.query(SQL_GET_E_TRANSFER_ENCOUNTER_DATA, [date, clientId]);
    return rows as ETransferEncounterDataRow[];
  }

  async markVisitUploaded(encountId: string): Promise<void> {
    await this.db.query(SQL_MARK_VISIT_UPLOADED, [encountId]);
  }
}
