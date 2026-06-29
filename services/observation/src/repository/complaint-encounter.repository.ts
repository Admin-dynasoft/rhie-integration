import type { DatabaseConnection } from '@rhie/database';
import type { ComplaintEncounterDataRow, PendingComplaintEncounterRow } from '../domain/types.js';
import {
  SQL_FIND_PENDING_COMPLAINT_ENCOUNTERS,
  SQL_GET_COMPLAINT_ENCOUNTER_DATA,
  SQL_MARK_OBSERVATION_UPLOADED,
} from './sql.js';

export class ComplaintEncounterRepository {
  constructor(private readonly db: DatabaseConnection) {}

  async findPendingComplaintEncounters(limit: number): Promise<PendingComplaintEncounterRow[]> {
    const [rows] = await this.db.query(SQL_FIND_PENDING_COMPLAINT_ENCOUNTERS, [limit]);
    return rows as PendingComplaintEncounterRow[];
  }

  async getComplaintEncounterData(
    date: string,
    clientId: number,
  ): Promise<ComplaintEncounterDataRow[]> {
    const [rows] = await this.db.query(SQL_GET_COMPLAINT_ENCOUNTER_DATA, [date, clientId]);
    return rows as ComplaintEncounterDataRow[];
  }

  async markObservationUploaded(encountId: string): Promise<void> {
    await this.db.query(SQL_MARK_OBSERVATION_UPLOADED, [encountId]);
  }
}
