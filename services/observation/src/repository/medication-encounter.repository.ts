import type { DatabaseConnection } from '@rhie/database';
import type { MedicationEncounterDataRow, PendingMedicationEncounterRow } from '../domain/types.js';
import {
  SQL_FIND_PENDING_MEDICATION_ENCOUNTERS,
  SQL_GET_MEDICATION_ENCOUNTER_DATA,
  SQL_MARK_OBSERVATION_UPLOADED,
} from './sql.js';

export class MedicationEncounterRepository {
  constructor(private readonly db: DatabaseConnection) {}

  async findPendingMedicationEncounters(limit: number): Promise<PendingMedicationEncounterRow[]> {
    const [rows] = await this.db.query(SQL_FIND_PENDING_MEDICATION_ENCOUNTERS, [limit]);
    return rows as PendingMedicationEncounterRow[];
  }

  async getMedicationEncounterData(
    date: string,
    clientId: number,
  ): Promise<MedicationEncounterDataRow[]> {
    const [rows] = await this.db.query(SQL_GET_MEDICATION_ENCOUNTER_DATA, [date, clientId]);
    return rows as MedicationEncounterDataRow[];
  }

  async markObservationUploaded(encountId: string): Promise<void> {
    await this.db.query(SQL_MARK_OBSERVATION_UPLOADED, [encountId]);
  }
}
