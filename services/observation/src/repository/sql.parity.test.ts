import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SQL_FIND_PENDING_COMPLAINT_ENCOUNTERS,
  SQL_GET_COMPLAINT_ENCOUNTER_DATA,
  SQL_MARK_OBSERVATION_UPLOADED,
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
