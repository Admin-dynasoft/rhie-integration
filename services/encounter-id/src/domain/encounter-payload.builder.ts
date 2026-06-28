import type {
  MainEncounterInput,
  MainEncounterPayload,
  PatientEncounterInput,
  PatientEncounterPayload,
} from './types.js';

export class EncounterPayloadBuilder {
  buildMainEncounter(input: MainEncounterInput): MainEncounterPayload {
    return {
      encountId: input.encountId,
      type: input.type,
      upid: input.upid,
      clientId: input.clientId,
      date: input.date,
      time: input.time,
      rhieStatus: 2,
      rhieUploadedAt: input.rhieUploadedAt,
    };
  }

  buildPatientEncounter(input: PatientEncounterInput): PatientEncounterPayload {
    return {
      encountId: input.encountId,
      type: input.type,
      upid: input.upid,
      clientId: input.clientId,
      sourceId: input.sourceId,
      sourceTable: input.sourceTable,
      date: input.date,
      time: input.time,
      rhieStatus: 2,
      rhieUploadedAt: input.rhieUploadedAt,
    };
  }
}

export function serializeEncounterPayload(
  payload: MainEncounterPayload | PatientEncounterPayload,
): string {
  return JSON.stringify(payload, null, 2);
}

export function mainEncounterToParams(payload: MainEncounterPayload): (string | number)[] {
  return [
    payload.encountId,
    payload.type,
    payload.upid,
    payload.clientId,
    payload.date,
    payload.time,
    payload.rhieStatus,
    payload.rhieUploadedAt,
  ];
}

export function patientEncounterToParams(payload: PatientEncounterPayload): (string | number)[] {
  return [
    payload.encountId,
    payload.type,
    payload.upid,
    payload.clientId,
    payload.sourceId,
    payload.sourceTable,
    payload.date,
    payload.time,
    payload.rhieStatus,
    payload.rhieUploadedAt,
  ];
}
