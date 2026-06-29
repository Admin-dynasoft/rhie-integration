import { phpEffectiveDateTimeUtc } from './complaint-payload.builder.js';
import type { DiagnosisEncounterDataRow, FhirDiagnosisConditionPayload } from './types.js';

/**
 * Builds FHIR Condition payload — port of UploadEncounterController::buildDiagnosticObservation()
 * (rhie/controllers/traches/UploadEncounterController.php)
 */
export class DiagnosisPayloadBuilder {
  build(observation: DiagnosisEncounterDataRow): FhirDiagnosisConditionPayload {
    return {
      resourceType: 'Condition',
      id: observation.observation_encount_id,
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: 'confirmed',
          },
        ],
      },
      code: {
        coding: [
          {
            system: 'https://icd.who.int',
            code: '1F42',
            display: observation.full_description ?? 'No description',
          },
        ],
      },
      subject: {
        reference: `Patient/${observation.upid}`,
      },
      encounter: {
        reference: `Encounter/${observation.reference_encount_id}`,
      },
      onsetDateTime: phpEffectiveDateTimeUtc(observation.order_time),
      asserter: {
        reference: 'Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653',
        display: observation.practitioner_name ?? 'System',
      },
    };
  }
}

export function serializeDiagnosisPayload(
  payload: FhirDiagnosisConditionPayload,
): FhirDiagnosisConditionPayload {
  return structuredClone(payload);
}

/** Row display from GetEncounterModel SQL — never 'Diagnosticc' (legacy dead-code typo in traches controller) */
export const DIAGNOSIS_DISPLAY = 'Diagnostic';
