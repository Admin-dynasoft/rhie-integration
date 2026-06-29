export interface PendingComplaintEncounterRow {
  client_id: number;
  date: string;
  upid: string;
  observation_encount_id: string;
}

export interface ComplaintEncounterDataRow {
  reference_encount_id: string;
  upid: string;
  client_id: number;
  main_date: string;
  observation_encount_id: string;
  source_id: number;
  main_display: string;
  display: string;
  div_display: string;
  full_description: string | null;
  order_time: string;
  practitioner_name: string | null;
  code: string;
}

export interface FhirComplaintObservationPayload {
  resourceType: 'Observation';
  id: string;
  status: string;
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  category: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  subject: {
    reference: string;
  };
  encounter: {
    reference: string;
  };
  performer: Array<{
    reference: string;
    display: string;
  }>;
  valueString: string;
  effectiveDateTime: string;
}

export interface ComplaintUploadResult {
  success: boolean;
  resourceType: string;
  observation_encount_id: string;
  http_code?: number;
  response?: unknown;
}

export interface PendingDiagnosisEncounterRow {
  client_id: number;
  date: string;
  upid: string;
  observation_encount_id: string;
}

export interface DiagnosisEncounterDataRow {
  reference_encount_id: string;
  upid: string;
  client_id: number;
  main_date: string;
  observation_encount_id: string;
  source_id: number;
  main_display: string;
  display: string;
  div_display: string;
  full_description: string | null;
  order_time: string;
  practitioner_name: string | null;
  code: string;
}

export interface FhirDiagnosisConditionPayload {
  resourceType: 'Condition';
  id: string;
  clinicalStatus: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  verificationStatus: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  subject: {
    reference: string;
  };
  encounter: {
    reference: string;
  };
  onsetDateTime: string;
  asserter: {
    reference: string;
    display: string;
  };
}

export interface DiagnosisUploadResult {
  success: boolean;
  resourceType: string;
  observation_encount_id: string;
  http_code?: number;
  response?: unknown;
}

export interface PendingMedicationEncounterRow {
  client_id: number;
  date: string;
  upid: string;
  observation_encount_id: string;
}

export interface MedicationEncounterDataRow {
  reference_encount_id: string;
  upid: string;
  client_id: number;
  main_date: string;
  observation_encount_id: string;
  source_id: number;
  main_display: string;
  display: string;
  div_display: string;
  duration: number | null;
  posologie: string | null;
  quantity: number | null;
  item: string | number | null;
  order_time: string;
  practitioner_name: string | null;
  full_description: string | null;
  code: string | null;
  /** Not in PHP SQL — used only in payload fallback for contactpoint extension */
  practitioner_phone?: string | null;
}

/** PHP buildMedicationRequestObservation() output — includes numeric "0" key from malformed array literal */
export type FhirMedicationRequestPayload = Record<string, unknown> & {
  resourceType: 'MedicationRequest';
  id: string;
  status: string;
  intent: string;
};

export interface MedicationUploadResult {
  success: boolean;
  resourceType: string;
  observation_encount_id: string;
  http_code?: number;
  response?: unknown;
}

export interface PendingLaboratoryEncounterRow {
  client_id: number;
  date: string;
  upid: string;
  observation_encount_id: string;
}

export interface LabResultEncounterDataRow {
  reference_encount_id: string;
  upid: string;
  client_id: number;
  main_date: string;
  observation_encount_id: string;
  source_id: number;
  main_display: string;
  display: string;
  div_display: string;
  full_description: string | null;
  result: string | null;
  order_time: string;
  practitioner_name: string | null;
  code: string;
}

export interface LabRequestEncounterDataRow {
  reference_encount_id: string;
  upid: string;
  client_id: number;
  main_date: string;
  observation_encount_id: string;
  source_id: number;
  main_display: string;
  display: string;
  div_display: string;
  full_description: string | null;
  order_time: string;
  practitioner_name: string | null;
  code: string;
}

export interface FhirLabResultObservationPayload {
  resourceType: 'Observation';
  id: string;
  status: string;
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  category: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  subject: {
    reference: string;
  };
  encounter: {
    reference: string;
  };
  performer: Array<{
    reference: string;
    display: string;
  }>;
  valueQuantity: {
    value: null;
    unit: string;
    system: string;
  };
  effectiveDateTime: string;
}

export interface FhirLabRequestServiceRequestPayload {
  resourceType: 'ServiceRequest';
  id: string;
  status: string;
  intent: string;
  category: {
    coding: {
      system: string;
      code: string;
      display: string;
    };
  };
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  subject: {
    reference: string;
  };
  encounter: {
    reference: string;
  };
  occurrenceDateTime: string;
  requester: {
    reference: string;
    display: string;
  };
  performer: Array<{
    reference: string;
    display: string;
  }>;
  locationReference: {
    reference: string;
    display: string;
  };
}

export interface LaboratoryUploadResult {
  success: boolean;
  resourceType: string;
  observation_encount_id: string;
  http_code?: number;
  response?: unknown;
}
