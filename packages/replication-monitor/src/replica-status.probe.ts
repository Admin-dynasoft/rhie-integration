import type { RowDataPacket, DatabaseConnection } from '@rhie/database';
import type { ReplicaStatusRow, ReplicationThreadStatus } from './types.js';

function readThreadStatus(value: unknown): ReplicationThreadStatus {
  if (value === 'Yes' || value === true || value === 1 || value === 'ON') {
    return 'yes';
  }
  if (value === 'No' || value === false || value === 0 || value === 'OFF') {
    return 'no';
  }
  return 'unknown';
}

function pickField(row: RowDataPacket, names: string[]): unknown {
  for (const name of names) {
    if (name in row && row[name] != null) {
      return row[name];
    }
  }
  return undefined;
}

/**
 * Probes MySQL replication status on an Online replica connection.
 * Supports MySQL 8.0+ SHOW REPLICA STATUS and legacy SHOW SLAVE STATUS column names.
 */
export async function probeReplicaStatus(db: DatabaseConnection): Promise<ReplicaStatusRow> {
  let rows: RowDataPacket[] = [];

  try {
    rows = await db.query<RowDataPacket[]>('SHOW REPLICA STATUS');
  } catch {
    try {
      rows = await db.query<RowDataPacket[]>('SHOW SLAVE STATUS');
    } catch (error) {
      return {
        ioRunning: 'unknown',
        sqlRunning: 'unknown',
        lagSeconds: null,
        lastError: error instanceof Error ? error.message : String(error),
        sourceHost: null,
        sourcePort: null,
        isReplica: false,
      };
    }
  }

  if (rows.length === 0) {
    return {
      ioRunning: 'unknown',
      sqlRunning: 'unknown',
      lagSeconds: null,
      lastError: null,
      sourceHost: null,
      sourcePort: null,
      isReplica: false,
    };
  }

  const row = rows[0];

  const ioRaw = pickField(row, [
    'Replica_IO_Running',
    'Slave_IO_Running',
  ]);
  const sqlRaw = pickField(row, [
    'Replica_SQL_Running',
    'Slave_SQL_Running',
  ]);
  const lagRaw = pickField(row, [
    'Seconds_Behind_Source',
    'Seconds_Behind_Master',
    'Seconds_Behind_Source_Applier',
  ]);
  const lastError = pickField(row, [
    'Last_Error',
    'Last_SQL_Error',
  ]);
  const sourceHost = pickField(row, ['Source_Host', 'Master_Host']);
  const sourcePort = pickField(row, ['Source_Port', 'Master_Port']);

  const lagSeconds =
    lagRaw == null || lagRaw === '' ? null : Number(lagRaw);

  return {
    ioRunning: readThreadStatus(ioRaw),
    sqlRunning: readThreadStatus(sqlRaw),
    lagSeconds: Number.isFinite(lagSeconds) ? lagSeconds : null,
    lastError: lastError != null ? String(lastError) : null,
    sourceHost: sourceHost != null ? String(sourceHost) : null,
    sourcePort: sourcePort != null ? Number(sourcePort) : null,
    isReplica: true,
  };
}
