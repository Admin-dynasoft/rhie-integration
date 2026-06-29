import type { DatabaseConnection } from '@rhie/database';
import type {
  LabRequestEncounterDataRow,
  LabResultEncounterDataRow,
  PendingLaboratoryEncounterRow,
} from '../domain/types.js';
import {
  SQL_FIND_PENDING_LAB_REQUEST_ENCOUNTERS,
  SQL_FIND_PENDING_LAB_RESULT_ENCOUNTERS,
  SQL_GET_LAB_REQUEST_ENCOUNTER_DATA,
  SQL_GET_LAB_RESULT_ENCOUNTER_DATA,
  SQL_MARK_OBSERVATION_UPLOADED,
} from './sql.js';

export class LaboratoryEncounterRepository {
  constructor(private readonly db: DatabaseConnection) {}

  async findPendingLabResultEncounters(limit: number): Promise<PendingLaboratoryEncounterRow[]> {
    const [rows] = await this.db.query(SQL_FIND_PENDING_LAB_RESULT_ENCOUNTERS, [limit]);
    return rows as PendingLaboratoryEncounterRow[];
  }

  async findPendingLabRequestEncounters(limit: number): Promise<PendingLaboratoryEncounterRow[]> {
    const [rows] = await this.db.query(SQL_FIND_PENDING_LAB_REQUEST_ENCOUNTERS, [limit]);
    return rows as PendingLaboratoryEncounterRow[];
  }

  async getLabResultEncounterData(
    date: string,
    clientId: number,
  ): Promise<LabResultEncounterDataRow[]> {
    const [rows] = await this.db.query(SQL_GET_LAB_RESULT_ENCOUNTER_DATA, [date, clientId]);
    return rows as LabResultEncounterDataRow[];
  }

  async getLabRequestEncounterData(
    date: string,
    clientId: number,
  ): Promise<LabRequestEncounterDataRow[]> {
    const [rows] = await this.db.query(SQL_GET_LAB_REQUEST_ENCOUNTER_DATA, [date, clientId]);
    return rows as LabRequestEncounterDataRow[];
  }

  async markObservationUploaded(encountId: string): Promise<void> {
    await this.db.query(SQL_MARK_OBSERVATION_UPLOADED, [encountId]);
  }
}
