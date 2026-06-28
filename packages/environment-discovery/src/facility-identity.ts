import type { RowDataPacket } from 'mysql2/promise';
import { withMySQLConnection } from './mysql-probe.js';
import type { CentralFacilityRow, MySQLCredentials } from './types.js';

export interface FacilityIdentity {
  facilityName: string;
  fosaid: string;
}

export async function readFacilityIdentity(
  credentials: MySQLCredentials,
  database: string,
): Promise<FacilityIdentity> {
  return withMySQLConnection(credentials, database, async (connection) => {
    const [rows] = await connection.query<RowDataPacket[]>(
      `
        SELECT hc, fosaid
        FROM address
        WHERE address_id = 1
        LIMIT 1
      `,
    );

    if (rows.length === 0) {
      throw new Error(
        `Database "${database}" has no facility identity row in address (address_id = 1).`,
      );
    }

    const row = rows[0]!;
    return {
      facilityName: row.hc != null ? String(row.hc) : database,
      fosaid: row.fosaid != null ? String(row.fosaid) : '',
    };
  });
}

export async function readCentralFacilities(
  credentials: MySQLCredentials,
  centralDatabase: string,
): Promise<CentralFacilityRow[]> {
  return withMySQLConnection(credentials, centralDatabase, async (connection) => {
    const [tableRows] = await connection.query<RowDataPacket[]>(
      `
        SELECT COUNT(*) AS table_count
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = 'health_facilities'
      `,
      [centralDatabase],
    );

    if (Number(tableRows[0]?.table_count ?? 0) === 0) {
      return [];
    }

    const [rows] = await connection.query<RowDataPacket[]>(
      `
        SELECT id, db_name, fosaid, db_host, db_user, db_password
        FROM health_facilities
        WHERE db_name IS NOT NULL
          AND db_name != ''
          AND fosaid IS NOT NULL
        ORDER BY id ASC
      `,
    );

    return rows.map((row) => ({
      id: Number(row.id),
      db_name: String(row.db_name),
      fosaid: String(row.fosaid),
      db_host: row.db_host != null ? String(row.db_host) : null,
      db_user: row.db_user != null ? String(row.db_user) : null,
      db_password: row.db_password != null ? String(row.db_password) : null,
    }));
  });
}

export async function centralRegistryAvailable(
  credentials: MySQLCredentials,
  centralDatabase: string,
): Promise<boolean> {
  try {
    const facilities = await readCentralFacilities(credentials, centralDatabase);
    return facilities.length > 0;
  } catch {
    return false;
  }
}
