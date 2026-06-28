import type { RowDataPacket } from '@rhie/database';
import type { DatabaseConnection } from '@rhie/database';
import type { ClientRegistryConfig } from '@rhie/config';
import type { PatientDataRow, UpidStatus } from '../domain/types.js';
import {
  SQL_FIND_PENDING_CLIENTS_WITH_REFERRAL,
  SQL_FIND_PENDING_CLIENTS_WITHOUT_REFERRAL,
  SQL_GET_UPIDS_BY_CLIENT,
  SQL_GET_CLIENT_DATA_BY_UPID,
  SQL_UPDATE_UPID_STATUS,
  SQL_MARK_CLIENT_AS_FAILED,
} from './sql.js';

export class ClientRegistryRepository {
  constructor(
    private readonly db: DatabaseConnection,
    private readonly config: ClientRegistryConfig,
  ) {}

  async findPendingClientIds(limit: number): Promise<number[]> {
    const sql = this.config.requireReferral
      ? SQL_FIND_PENDING_CLIENTS_WITH_REFERRAL
      : SQL_FIND_PENDING_CLIENTS_WITHOUT_REFERRAL;

    const rows = await this.db.query<RowDataPacket[] & { patient_id: number }[]>(sql, [limit]);
    return rows.map((row) => Number(row.patient_id));
  }

  /**
   * PHP passes patient_id from batch as clientID but queries client_id column.
   * Preserved exactly as production PHP behaviour.
   */
  async getUpidsByClient(clientId: number): Promise<string[]> {
    const rows = await this.db.query<RowDataPacket[] & { upid: string }[]>(
      SQL_GET_UPIDS_BY_CLIENT,
      [clientId],
    );
    return rows.map((row) => row.upid);
  }

  async getClientDataByUpid(upid: string): Promise<PatientDataRow | null> {
    const rows = await this.db.query<RowDataPacket[]>(SQL_GET_CLIENT_DATA_BY_UPID, [upid]);
    if (rows.length === 0) {
      return null;
    }
    return rows[0] as unknown as PatientDataRow;
  }

  async updateUpidStatus(upid: string, status: UpidStatus): Promise<void> {
    await this.db.execute(SQL_UPDATE_UPID_STATUS, [status, upid]);
  }

  async markClientAsFailed(clientId: number): Promise<void> {
    await this.db.execute(SQL_MARK_CLIENT_AS_FAILED, [clientId]);
  }
}
