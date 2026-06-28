export { DatabaseConnection, DatabaseManager } from './connection.js';
export type { DatabaseConnectionOptions, QueryResult } from './connection.js';

export {
  RHIE_STATUS,
  checkDatabaseHealth,
  countPendingRecords,
} from './helpers.js';
export type { RhieStatusUpdate } from './helpers.js';

export type { RowDataPacket, ResultSetHeader, PoolConnection } from './connection.js';
