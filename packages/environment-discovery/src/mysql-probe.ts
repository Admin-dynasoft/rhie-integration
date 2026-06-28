import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';
import type { MySQLCredentials } from './types.js';
import { EnvironmentDiscoveryError } from './errors.js';

export async function withMySQLConnection<T>(
  credentials: MySQLCredentials,
  database: string | undefined,
  fn: (connection: Connection) => Promise<T>,
): Promise<T> {
  const connection = await mysql.createConnection({
    host: credentials.host,
    port: credentials.port,
    user: credentials.user,
    password: credentials.password,
    database,
    connectTimeout: 10_000,
  });

  try {
    return await fn(connection);
  } finally {
    await connection.end();
  }
}

export async function listDatabases(credentials: MySQLCredentials): Promise<string[]> {
  return withMySQLConnection(credentials, undefined, async (connection) => {
    const [rows] = await connection.query<RowDataPacket[]>('SHOW DATABASES');
    return rows
      .map((row) => String(row.Database))
      .filter((name) => name.length > 0);
  });
}

export async function databaseExists(
  credentials: MySQLCredentials,
  database: string,
): Promise<boolean> {
  const databases = await listDatabases(credentials);
  return databases.includes(database);
}

export async function listTables(
  credentials: MySQLCredentials,
  database: string,
): Promise<Set<string>> {
  return withMySQLConnection(credentials, database, async (connection) => {
    const [rows] = await connection.query<RowDataPacket[]>(
      `
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
      `,
      [database],
    );

    return new Set(rows.map((row) => String(row.TABLE_NAME).toLowerCase()));
  });
}

export function wrapMySQLError(error: unknown, context: string): EnvironmentDiscoveryError {
  if (error instanceof EnvironmentDiscoveryError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new EnvironmentDiscoveryError(`${context}: ${message}`);
}
