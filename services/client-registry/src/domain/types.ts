export type UpidStatus = 0 | 1 | 2 | 3;

export interface PatientDataRow {
  UPID: string;
  nida: string;
  full_names: string;
  last_name: string;
  first_name: string;
  gender: string;
  marital_status: string | number;
  phone: string;
  birthdate: string;
  rhie_status: number;
  state: string;
  state_id: number;
  district: string;
  sector: string;
  cell: string;
  line: string;
  referral: boolean | number;
}

export interface FhirPatientPayload {
  resourceType: 'Patient';
  id: string;
  identifier: Array<{ system: string; value: string }>;
  active: boolean;
  name: Array<{ family: string; given: string[] }>;
  gender: 'male' | 'female';
  birthDate: string;
  deceasedBoolean: boolean;
  telecom: Array<{ system: string; value: string; use: string }>;
  address: Array<{
    type: string;
    country: string;
    state: string;
    district: string;
    line: string;
    city: string;
    postalCode: string;
  }>;
  maritalStatus: {
    coding: Array<{ system: string; code: string; display: string }>;
  };
  extension: Array<Record<string, never>>;
}

export interface ClientProcessResult {
  processed: number;
  failed: number;
  skipped: number;
}

export interface UpidProcessLogEntry {
  clientId: number;
  upid: string;
  steps: Array<Record<string, unknown>>;
}
