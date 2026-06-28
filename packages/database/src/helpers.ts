import type { RowDataPacket } from 'mysql2/promise';
import type { DatabaseConnection } from './connection.js';

/**
 * Placeholder column names for RHIE status tracking.
 * Actual column/table names will be mapped during business logic implementation.
 */
export const RHIE_STATUS = {
  PENDING: 0,
  IN_PROGRESS: 1,
  UPLOADED: 2,
  FAILED: 3,
} as const;

export interface RhieStatusUpdate {
  recordId: number | string;
  status: number;
  rhieReference?: string;
  errorMessage?: string;
}

export async function checkDatabaseHealth(db: DatabaseConnection): Promise<{
  ok: boolean;
  latencyMs: number;
  message?: string;
}> {
  const start = Date.now();
  try {
    const ok = await db.ping();
    return {
      ok,
      latencyMs: Date.now() - start,
      message: ok ? 'Database reachable' : 'Database ping failed',
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function countPendingRecords(
  db: DatabaseConnection,
  table: string,
  statusColumn: string,
  pendingStatus: number = RHIE_STATUS.PENDING,
): Promise<number> {
  const rows = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM \`${table}\` WHERE \`${statusColumn}\` = ?`,
    [pendingStatus],
  );
  return Number(rows[0]?.count ?? 0);
}
