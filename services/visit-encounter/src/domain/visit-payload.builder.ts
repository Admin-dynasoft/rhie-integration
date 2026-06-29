import type {
  VisitEncounterDataRow,
  ETransferEncounterDataRow,
  FhirVisitEncounterPayload,
  FhirETransferEncounterPayload,
} from './types.js';

/** PHP date('c', strtotime($datetime)) in Africa/Kigali (UTC+2, no DST). */
export function phpDateC(dateTime: string | null | undefined): string {
  if (!dateTime || dateTime.trim() === '') {
    return new Date().toISOString();
  }

  const trimmed = dateTime.trim();
  const [datePart, timePart = '00:00:00'] = trimmed.includes('T')
    ? trimmed.split('T')
    : trimmed.split(' ');

  return `${datePart}T${timePart}+02:00`;
}

/** PHP date('c') at upload time — Africa/Kigali (+02:00). */
export function phpNowDateC(now: () => Date = () => new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Kigali',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+02:00`;
}

/**
 * Builds FHIR Encounter payload — exact port of UploadVisitEncounterController::buildFHIRPayload()
 */
export class VisitPayloadBuilder {
  build(visit: VisitEncounterDataRow): FhirVisitEncounterPayload {
    const upid = visit.upid;
    const practitionerId = visit.practitioner_id;
    const facilityName = visit.facility_name ?? '';

    return {
      resourceType: 'Encounter',
      id: visit.resource_encount_id,
      meta: {
        tag: [
          {
            system: 'http://fhir.openmrs.org/ext/encounter-tag',
            code: 'encounter',
            display: 'Encounter',
          },
        ],
      },
      status: 'finished',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'Ambulatory',
      },
      type: [
        {
          coding: [
            {
              display: visit.type_display,
            },
          ],
        },
      ],
      serviceType: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/service-type',
            display: 'Outpatients',
          },
        ],
      },
      subject: {
        reference: `Patient/${upid}`,
        type: 'Patient',
        identifier: {
          type: {
            coding: [
              {
                code: 'UPID',
                display: 'UPID',
              },
            ],
          },
          value: upid,
        },
        display: visit.patient_name ?? '',
      },
      participant: [
        {
          individual: {
            reference: `Practitioner/${practitionerId}`,
            type: 'Practitioner',
            identifier: {
              value: practitionerId,
            },
            display: visit.practitioner_name ?? '',
          },
        },
      ],
      period: {
        start: phpDateC(visit.order_time),
      },
      location: [
        {
          location: {
            reference: `Location/${visit.location_id}`,
            type: 'Location',
            identifier: {
              value: facilityName,
            },
            display: `${facilityName} HC`,
          },
        },
      ],
    };
  }

  /** Port of UploadVisitEncounterController::buildRefFHIRPayload() */
  buildRef(visit: ETransferEncounterDataRow, now: () => Date = () => new Date()): FhirETransferEncounterPayload {
    const upid = visit.upid;
    const practitionerId = visit.practitioner_id ?? 'MS-PRAC-0025-001';
    const originName = visit.origin_facility_name ?? '';
    const destinationName = visit.destination_facility_name ?? '';
    const destinationLocationId = visit.destination_location_id ?? '';
    const start = phpDateC(visit.order_time ?? null);

    return {
      resourceType: 'Encounter',
      id: visit.resource_encount_id,
      meta: {
        tag: [
          {
            system: 'http://fhir.openmrs.org/ext/encounter-tag',
            code: 'encounter',
            display: 'Encounter',
          },
        ],
      },
      status: 'planned',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'Ambulatory',
      },
      type: [
        {
          coding: [
            {
              display: visit.type_display ?? 'TRANSFER_ENCOUNTER',
            },
          ],
        },
      ],
      serviceType: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/service-type',
            display: 'Outpatients',
          },
        ],
      },
      subject: {
        reference: `Patient/${upid}`,
        type: 'Patient',
        identifier: {
          type: {
            coding: [
              {
                code: 'UPID',
                display: 'UPID',
              },
            ],
          },
          value: upid,
        },
        display: visit.patient_name ?? '',
      },
      participant: [
        {
          individual: {
            reference: `Practitioner/${practitionerId}`,
            type: 'Practitioner',
            identifier: {
              value: practitionerId,
            },
            display: visit.practitioner_name ?? 'System',
          },
        },
      ],
      period: {
        start,
        end: phpNowDateC(now),
      },
      location: [
        {
          location: {
            reference: `Location/${visit.origin_location_id}`,
            type: 'Location',
            identifier: {
              value: originName,
            },
            display: `${originName} HC`,
          },
        },
      ],
      hospitalization: {
        origin: {
          reference: `Location/${visit.origin_location_id}`,
          type: 'Location',
          identifier: {
            value: originName,
          },
          display: `${originName} HC`,
        },
        destination: {
          reference: `Location/${destinationLocationId}`,
          type: 'Location',
          identifier: {
            value: destinationName,
          },
          display: destinationName,
        },
      },
      partOf: {
        reference: `Encounter/${visit.reference_encount_id}`,
      },
    };
  }
}

export function serializeVisitPayload(payload: FhirVisitEncounterPayload): FhirVisitEncounterPayload {
  return structuredClone(payload);
}

export function serializeETransferPayload(
  payload: FhirETransferEncounterPayload,
): FhirETransferEncounterPayload {
  return structuredClone(payload);
}
