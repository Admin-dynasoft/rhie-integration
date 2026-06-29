import type { VisitEncounterDataRow, FhirVisitEncounterPayload } from './types.js';

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
}

export function serializeVisitPayload(payload: FhirVisitEncounterPayload): FhirVisitEncounterPayload {
  return structuredClone(payload);
}
