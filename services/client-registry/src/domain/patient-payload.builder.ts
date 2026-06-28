import { rhieSanitizeUpid } from '@rhie/shared';
import type { PatientDataRow, FhirPatientPayload } from './types.js';

const MARITAL_STATUS_MAP: Record<string, { code: string; display: string }> = {
  '0': { code: 'S', display: 'Single' },
  '1': { code: 'M', display: 'Married' },
  '2': { code: 'W', display: 'Widowed' },
  '3': { code: 'D', display: 'Divorced' },
};

/**
 * Builds FHIR Patient payload — exact port of ClientRegistryController.buildPatientPayload()
 */
export class PatientPayloadBuilder {
  build(data: PatientDataRow): FhirPatientPayload {
    const gender = this.mapGender(data.gender);
    const ms = this.mapMaritalStatus(data.marital_status);
    const upid = rhieSanitizeUpid(data.UPID) ?? '';

    // PHP: $given = $data['last_name']; $family = $data['first_name'];
    const given = data.last_name;
    const family = data.first_name;

    return {
      resourceType: 'Patient',
      id: upid,
      identifier: [
        { system: 'UPI', value: upid },
        { system: 'NID', value: String(data.nida) },
      ],
      active: true,
      name: [{ family, given: [given] }],
      gender,
      birthDate: String(data.birthdate),
      deceasedBoolean: true,
      telecom: [
        {
          system: 'phone',
          value: '+25' + String(data.phone),
          use: 'mobile',
        },
      ],
      address: [
        {
          type: 'physical',
          country: 'Rwanda',
          state: data.state,
          district: data.district,
          line: data.line,
          city: data.state,
          postalCode: '',
        },
      ],
      maritalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
            code: ms.code,
            display: ms.display,
          },
        ],
      },
      extension: [{}],
    };
  }

  /**
   * Serialize payload the same way PHP json_encode($payload, JSON_UNESCAPED_SLASHES) does.
   */
  serialize(payload: FhirPatientPayload): string {
    return JSON.stringify(payload);
  }

  mapGender(sex: string): 'male' | 'female' {
    const normalized = sex.toLowerCase();
    return ['m', 'male', '1'].includes(normalized) ? 'male' : 'female';
  }

  mapMaritalStatus(code: string | number): { code: string; display: string } {
    const key = String(code);
    return MARITAL_STATUS_MAP[key] ?? MARITAL_STATUS_MAP['0'];
  }
}

export function buildPatientPayload(data: PatientDataRow): FhirPatientPayload {
  return new PatientPayloadBuilder().build(data);
}

export function serializePatientPayload(payload: FhirPatientPayload): string {
  return new PatientPayloadBuilder().serialize(payload);
}
