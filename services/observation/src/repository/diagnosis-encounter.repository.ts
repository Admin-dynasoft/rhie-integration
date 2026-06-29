import type { DatabaseConnection } from '@rhie/database';
import type { DiagnosisEncounterDataRow, PendingDiagnosisEncounterRow } from '../domain/types.js';
import {
  SQL_FIND_PENDING_DIAGNOSIS_ENCOUNTERS,
  SQL_GET_DIAGNOSIS_ENCOUNTER_DATA,
  SQL_MARK_OBSERVATION_UPLOADED,
} from './sql.js';

export class DiagnosisEncounterRepository {
  constructor(private readonly db: DatabaseConnection) {}

  async findPendingDiagnosisEncounters(limit: number): Promise<PendingDiagnosisEncounterRow[]> {
    const [rows] = await this.db.query(SQL_FIND_PENDING_DIAGNOSIS_ENCOUNTERS, [limit]);
    return rows as PendingDiagnosisEncounterRow[];
  }

  async getDiagnosisEncounterData(
    date: string,
    clientId: number,
  ): Promise<DiagnosisEncounterDataRow[]> {
    const [rows] = await this.db.query(SQL_GET_DIAGNOSIS_ENCOUNTER_DATA, [date, clientId]);
    return rows as DiagnosisEncounterDataRow[];
  }

  async markObservationUploaded(encountId: string): Promise<void> {
    await this.db.query(SQL_MARK_OBSERVATION_UPLOADED, [encountId]);
  }
}
