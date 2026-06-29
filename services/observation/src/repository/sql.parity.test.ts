import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SQL_FIND_PENDING_COMPLAINT_ENCOUNTERS,
  SQL_GET_COMPLAINT_ENCOUNTER_DATA,
  SQL_MARK_OBSERVATION_UPLOADED,
  SQL_FIND_PENDING_DIAGNOSIS_ENCOUNTERS,
  SQL_GET_DIAGNOSIS_ENCOUNTER_DATA,
} from './sql.js';

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

describe('SQL parity with PHP Complaint Encounter Upload', () => {
  it('complaint data query matches GetEncounterModel::getComplaintEncounterData', () => {
    const php = `
      SELECT
        em.encount_id AS reference_encount_id,
        em.upid,
        em.client_id,
        em.date AS main_date,
        ep.encount_id AS observation_encount_id,
        ep.source_id,
        'Consultation Encounter' AS main_display,
        'Chief Complaint' AS display,
        'Chief Complaint' AS div_display,
        pl.plainte AS full_description,
        vs.created_at AS order_time,
        u.fullname AS practitioner_name,
        'Complaint-001' AS code
      FROM encounter_main em
      INNER JOIN encounter_patients ep ON ep.client_id = em.client_id AND ep.date = em.date AND em.type = 'VISIT_ENCOUNTER'
      INNER JOIN vital_sign vs ON vs.vital_sign_id = ep.source_id
      LEFT JOIN users u ON vs.user_id = u.id
      LEFT JOIN plaintes pl ON pl.id = vs.value
      WHERE ep.type = 'complaint' AND ep.rhie_status = 2 AND em.date = ? AND em.client_id = ?
      AND em.upid NOT LIKE 'UP%'
    `;
    assert.equal(normalizeSql(SQL_GET_COMPLAINT_ENCOUNTER_DATA), normalizeSql(php));
  });

  it('mark observation uploaded matches UploadEncounterModel::markObservationUploaded', () => {
    const php = `
      UPDATE encounter_patients SET rhie_status = 1, rhie_uploaded_at = NOW() WHERE encount_id = ?
    `;
    assert.equal(normalizeSql(SQL_MARK_OBSERVATION_UPLOADED), normalizeSql(php));
  });

  it('pending batch query filters complaint type with rhie_status = 2', () => {
    assert.match(normalizeSql(SQL_FIND_PENDING_COMPLAINT_ENCOUNTERS), /ep\.type = 'complaint'/);
    assert.match(normalizeSql(SQL_FIND_PENDING_COMPLAINT_ENCOUNTERS), /ep\.rhie_status = 2/);
    assert.match(normalizeSql(SQL_FIND_PENDING_COMPLAINT_ENCOUNTERS), /em\.type = 'visit_encounter'/);
  });
});

describe('SQL parity with PHP Diagnosis Encounter Upload', () => {
  it('diagnosis data query matches GetEncounterModel::getDiagEncounterData', () => {
    const php = `
      SELECT
        em.encount_id AS reference_encount_id,
        em.upid,
        em.client_id,
        em.date AS main_date,
        ep.encount_id AS observation_encount_id,
        ep.source_id,
        'Consultation Encounter' AS main_display,
        'Diagnostic' AS display,
        'Diagnostic' AS div_display,
        d.english AS full_description,
        dc.time AS order_time,
        u.fullname AS practitioner_name,
        'Diag-000' AS code
      FROM encounter_main em
      INNER JOIN encounter_patients ep ON ep.client_id = em.client_id AND ep.date = em.date AND em.type = 'VISIT_ENCOUNTER'
      INNER JOIN diag_client dc ON dc.id = ep.source_id
      LEFT JOIN diags d ON dc.diag_id = d.id
      LEFT JOIN users u ON dc.user = u.id
      WHERE ep.type = 'diagnostic' AND em.date = ? AND em.client_id = ?
      AND em.upid NOT LIKE 'UP%'
    `;
    assert.equal(normalizeSql(SQL_GET_DIAGNOSIS_ENCOUNTER_DATA), normalizeSql(php));
  });

  it('diagnosis data query does not filter ep.rhie_status (PHP parity)', () => {
    assert.doesNotMatch(normalizeSql(SQL_GET_DIAGNOSIS_ENCOUNTER_DATA), /ep\.rhie_status/);
  });

  it('pending batch query filters diagnostic type with rhie_status = 2', () => {
    assert.match(normalizeSql(SQL_FIND_PENDING_DIAGNOSIS_ENCOUNTERS), /ep\.type = 'diagnostic'/);
    assert.match(normalizeSql(SQL_FIND_PENDING_DIAGNOSIS_ENCOUNTERS), /ep\.rhie_status = 2/);
  });
});
