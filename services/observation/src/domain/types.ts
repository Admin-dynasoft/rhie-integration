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
