import type { DatabaseConnection } from '@rhie/database';
import type { PendingVisitEncounterRow, VisitEncounterDataRow } from '../domain/types.js';
import {
  SQL_FIND_PENDING_VISIT_ENCOUNTERS,
  SQL_GET_VISIT_ENCOUNTER_DATA,
  SQL_MARK_VISIT_UPLOADED,
} from './sql.js';

export class VisitEncounterRepository {
  constructor(private readonly db: DatabaseConnection) {}

  async findPendingVisitEncounters(limit: number): Promise<PendingVisitEncounterRow[]> {
    const [rows] = await this.db.query(SQL_FIND_PENDING_VISIT_ENCOUNTERS, [limit]);
    return rows as PendingVisitEncounterRow[];
  }

  async getVisitEncounterData(date: string, clientId: number): Promise<VisitEncounterDataRow[]> {
    const [rows] = await this.db.query(SQL_GET_VISIT_ENCOUNTER_DATA, [date, clientId]);
    return rows as VisitEncounterDataRow[];
  }

  async markVisitUploaded(encountId: string): Promise<void> {
    await this.db.query(SQL_MARK_VISIT_UPLOADED, [encountId]);
  }
}
