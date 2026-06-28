import type { RowDataPacket, DatabaseConnection } from '@rhie/database';
import type {
  MainEncounterPayload,
  PatientEncounterPayload,
  VisitEncounterRow,
  OrderEncounterRow,
  LabResultRow,
  DiagEncounterRow,
  ComplaintEncounterRow,
  VitalSignEncounterRow,
  NcdEncounterRow,
  ReferralEncounterRow,
} from '../domain/types.js';
import {
  mainEncounterToParams,
  patientEncounterToParams,
} from '../domain/encounter-payload.builder.js';
import {
  SQL_VISIT_ENCOUNTERS,
  SQL_TRANSFER_ENCOUNTERS,
  SQL_ORDERS_ENCOUNTERS,
  SQL_LAB_RESULTS,
  SQL_LAB_REQUEST,
  SQL_DIAG_ENCOUNTERS,
  SQL_COMPLAINT_ENCOUNTERS,
  SQL_VITAL_SIGN_ENCOUNTERS,
  SQL_NCD_VITAL,
  SQL_NCD_PLAINTES,
  SQL_NCD_DIAGNOSTIC,
  SQL_REFERRAL_ENCOUNTERS,
  SQL_INSERT_MAIN_ENCOUNTER,
  SQL_INSERT_PATIENT_ENCOUNTER,
  SQL_CHECK_MAIN_ENCOUNTER,
  SQL_MARK_VISIT,
  SQL_MARK_ORDER,
  SQL_MARK_LAB,
  SQL_MARK_DIAG,
  SQL_MARK_COMPLAINT,
  SQL_MARK_VITAL_SIGN,
  SQL_MARK_NCD,
} from './sql.js';

export class EncounterRepository {
  constructor(private readonly db: DatabaseConnection) {}

  async fetchVisitEncounters(startDate: string): Promise<VisitEncounterRow[]> {
    const rows = await this.db.query<RowDataPacket[]>(SQL_VISIT_ENCOUNTERS, [startDate]);
    return rows as unknown as VisitEncounterRow[];
  }

  async fetchTransferEncounters(startDate: string): Promise<VisitEncounterRow[]> {
    const rows = await this.db.query<RowDataPacket[]>(SQL_TRANSFER_ENCOUNTERS, [startDate]);
    return rows as unknown as VisitEncounterRow[];
  }

  async fetchOrdersEncounters(
    orderType: string,
    startDate: string,
  ): Promise<OrderEncounterRow[]> {
    const rows = await this.db.query<RowDataPacket[]>(SQL_ORDERS_ENCOUNTERS, [
      orderType,
      startDate,
    ]);
    return rows as unknown as OrderEncounterRow[];
  }

  async fetchLabResults(startDate: string): Promise<LabResultRow[]> {
    const rows = await this.db.query<RowDataPacket[]>(SQL_LAB_RESULTS, [startDate]);
    return rows as unknown as LabResultRow[];
  }

  async fetchLabRequests(startDate: string): Promise<OrderEncounterRow[]> {
    const rows = await this.db.query<RowDataPacket[]>(SQL_LAB_REQUEST, [startDate]);
    return rows as unknown as OrderEncounterRow[];
  }

  async fetchDiagEncounters(startDate: string): Promise<DiagEncounterRow[]> {
    const rows = await this.db.query<RowDataPacket[]>(SQL_DIAG_ENCOUNTERS, [startDate]);
    return rows as unknown as DiagEncounterRow[];
  }

  async fetchComplaintEncounters(startDate: string): Promise<ComplaintEncounterRow[]> {
    const rows = await this.db.query<RowDataPacket[]>(SQL_COMPLAINT_ENCOUNTERS, [startDate]);
    return rows as unknown as ComplaintEncounterRow[];
  }

  async fetchVitalSignEncounters(startDate: string): Promise<VitalSignEncounterRow[]> {
    const rows = await this.db.query<RowDataPacket[]>(SQL_VITAL_SIGN_ENCOUNTERS, [startDate]);
    return rows as unknown as VitalSignEncounterRow[];
  }

  async fetchNcdVitalEncounters(startDate: string): Promise<NcdEncounterRow[]> {
    const rows = await this.db.query<RowDataPacket[]>(SQL_NCD_VITAL, [startDate]);
    return rows as unknown as NcdEncounterRow[];
  }

  async fetchNcdPlaintesEncounters(startDate: string): Promise<NcdEncounterRow[]> {
    const rows = await this.db.query<RowDataPacket[]>(SQL_NCD_PLAINTES, [startDate]);
    return rows as unknown as NcdEncounterRow[];
  }

  async fetchNcdDiagnosticEncounters(startDate: string): Promise<NcdEncounterRow[]> {
    const rows = await this.db.query<RowDataPacket[]>(SQL_NCD_DIAGNOSTIC, [startDate]);
    return rows as unknown as NcdEncounterRow[];
  }

  async fetchReferralEncounters(startDate: string): Promise<ReferralEncounterRow[]> {
    const rows = await this.db.query<RowDataPacket[]>(SQL_REFERRAL_ENCOUNTERS, [startDate]);
    return rows as unknown as ReferralEncounterRow[];
  }

  async mainEncounterExists(
    upid: string,
    clientId: number,
    date: string,
    type: string,
  ): Promise<boolean> {
    const rows = await this.db.query<RowDataPacket[]>(SQL_CHECK_MAIN_ENCOUNTER, [
      upid,
      clientId,
      date,
      type,
    ]);
    return rows.length > 0;
  }

  async insertMainEncounter(payload: MainEncounterPayload): Promise<void> {
    await this.db.execute(SQL_INSERT_MAIN_ENCOUNTER, mainEncounterToParams(payload));
  }

  async insertPatientEncounter(payload: PatientEncounterPayload): Promise<void> {
    await this.db.execute(SQL_INSERT_PATIENT_ENCOUNTER, patientEncounterToParams(payload));
  }

  async markVisitAsUploaded(clientId: number): Promise<void> {
    await this.db.execute(SQL_MARK_VISIT, [clientId]);
  }

  async markOrderAsUploaded(orderId: number): Promise<void> {
    await this.db.execute(SQL_MARK_ORDER, [orderId]);
  }

  async markLabAsUploaded(testId: number): Promise<void> {
    await this.db.execute(SQL_MARK_LAB, [testId]);
  }

  async markDiagAsUploaded(clientId: number, date: string): Promise<void> {
    await this.db.execute(SQL_MARK_DIAG, [clientId, date]);
  }

  async markComplaintAsUploaded(patientId: number, date: string): Promise<void> {
    await this.db.execute(SQL_MARK_COMPLAINT, [patientId, date]);
  }

  async markVitalSignAsUploaded(patientId: number, date: string): Promise<void> {
    await this.db.execute(SQL_MARK_VITAL_SIGN, [patientId, date]);
  }

  async markNcdAsUploaded(clientId: number, date: string): Promise<void> {
    await this.db.execute(SQL_MARK_NCD, [clientId, date]);
  }
}
