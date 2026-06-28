export interface VisitEncounterRow {
  date: string;
  time: string;
  client_id: number;
  upid: string;
  referral: boolean | number;
}

export interface OrderEncounterRow {
  order_id: number;
  date: string;
  time: string;
  client_id: number;
  upid: string;
  referral: boolean | number;
}

export interface LabResultRow {
  test_id: number;
  date: string;
  time: string;
  client_id: number;
  upid: string;
  referral: boolean | number;
}

export interface DiagEncounterRow {
  upid: string;
  client_id: number;
  source_id: number;
  source_date: string;
  diagnosis: string;
  referral: boolean | number;
}

export interface ComplaintEncounterRow {
  upid: string;
  patient_id: number;
  source_id: number;
  source_date: string;
  referral: boolean | number;
}

export interface VitalSignEncounterRow {
  upid: string;
  patient_id: number;
  source_id: number;
  source_date: string;
  referral: boolean | number;
}

export interface NcdEncounterRow {
  upid: string;
  client_id: number;
  source_id: number;
  source_date: string;
  referral: boolean | number;
}

export interface ReferralEncounterRow {
  upid: string;
  client_id: number;
  source_id: number;
  source_date: string;
}

export interface MainEncounterPayload {
  encountId: string;
  type: string;
  upid: string;
  clientId: number;
  date: string;
  time: string;
  rhieStatus: 2;
  rhieUploadedAt: string;
}

export interface PatientEncounterPayload {
  encountId: string;
  type: string;
  upid: string;
  clientId: number;
  sourceId: number;
  sourceTable: string;
  date: string;
  time: string;
  rhieStatus: 2;
  rhieUploadedAt: string;
}

export interface MainEncounterInput {
  encountId: string;
  type: string;
  upid: string;
  clientId: number;
  date: string;
  time: string;
  rhieUploadedAt: string;
}

export interface PatientEncounterInput {
  encountId: string;
  type: string;
  upid: string;
  clientId: number;
  sourceId: number;
  sourceTable: string;
  date: string;
  time: string;
  rhieUploadedAt: string;
}

export type EncounterGeneratorName =
  | 'visit'
  | 'transfer'
  | 'consultation'
  | 'complaint'
  | 'vital_sign'
  | 'lab_request'
  | 'medicine'
  | 'lab'
  | 'diagnostic'
  | 'ncd_vital'
  | 'ncd_plaintes'
  | 'ncd_diagnostic'
  | 'referral';

export interface GeneratorResult {
  processed: number;
  failed: number;
  skipped: number;
}
