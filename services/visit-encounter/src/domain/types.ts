export interface PendingVisitEncounterRow {
  client_id: number;
  upid: string;
  date: string;
  age: string;
  resource_encount_id: string;
}

/** Read-only batch selection breakdown for DEBUG logging (does not affect processing). */
export interface BatchSelectionDiagnostics {
  encounterType: 'VISIT_ENCOUNTER' | 'E_TRANSFER';
  rhieStatus2Count: number;
  batchEligibleCount: number;
  blockedByUpidStatus: number;
  blockedByUpidPrefix: number;
  blockedByAge: number;
  blockedByDocumentNumber: number;
}

export interface VisitEncounterDataRow {
  resource_encount_id: string;
  upid: string;
  client_id: number;
  visit_date: string;
  patient_name: string;
  type_display: string;
  display: string;
  div_display: string;
  order_time: string;
  practitioner_name: string;
  practitioner_id: string;
  facility_name: string;
  location_id: string;
}

export interface FhirVisitEncounterPayload {
  resourceType: 'Encounter';
  id: string;
  meta: {
    tag: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  status: string;
  class: {
    system: string;
    code: string;
    display: string;
  };
  type: Array<{
    coding: Array<{
      display: string;
    }>;
  }>;
  serviceType: {
    coding: Array<{
      system: string;
      display: string;
    }>;
  };
  subject: {
    reference: string;
    type: string;
    identifier: {
      type: {
        coding: Array<{
          code: string;
          display: string;
        }>;
      };
      value: string;
    };
    display: string;
  };
  participant: Array<{
    individual: {
      reference: string;
      type: string;
      identifier: {
        value: string;
      };
      display: string;
    };
  }>;
  period: {
    start: string;
  };
  location: Array<{
    location: {
      reference: string;
      type: string;
      identifier: {
        value: string;
      };
      display: string;
    };
  }>;
}

export interface VisitUploadResult {
  endpoint: string;
  kind: string;
  encounter_id: string;
  upid: string;
  http_code?: number;
  response?: unknown;
}

export interface ETransferEncounterDataRow {
  resource_encount_id: string;
  reference_encount_id: string;
  upid: string;
  client_id: number;
  visit_date: string;
  patient_name: string;
  type_display: string;
  display: string;
  div_display: string;
  order_time: string;
  practitioner_name: string;
  practitioner_id: string;
  origin_facility_name: string;
  destination_facility_name: string;
  origin_location_id: string;
  /** Not selected by PHP SQL — absent at runtime */
  destination_location_id?: string;
}

export interface FhirETransferEncounterPayload extends Omit<FhirVisitEncounterPayload, 'period' | 'location'> {
  status: string;
  period: {
    start: string;
    end: string;
  };
  location: Array<{
    location: {
      reference: string;
      type: string;
      identifier: {
        value: string;
      };
      display: string;
    };
  }>;
  hospitalization: {
    origin: {
      reference: string;
      type: string;
      identifier: { value: string };
      display: string;
    };
    destination: {
      reference: string;
      type: string;
      identifier: { value: string };
      display: string;
    };
  };
  partOf: {
    reference: string;
  };
}
