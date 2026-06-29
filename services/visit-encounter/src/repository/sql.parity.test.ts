import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SQL_FIND_PENDING_VISIT_ENCOUNTERS,
  SQL_GET_VISIT_ENCOUNTER_DATA,
  SQL_MARK_VISIT_UPLOADED,
} from './sql.js';

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

describe('SQL parity with PHP Visit Encounter Upload', () => {
  it('pending visit query matches upload_visit_encounters_batch.php', () => {
    const php = `
      SELECT DISTINCT
        em.client_id,
        up.upid,
        em.date,
        p.age,
        em.encount_id AS resource_encount_id
      FROM encounter_main em
      LEFT JOIN upid_patients up ON em.client_id = up.client_id
      LEFT JOIN patients p ON em.client_id = p.patient_id
      WHERE type IN ('VISIT_ENCOUNTER')
      AND em.rhie_status = 2 AND up.status = 2
      AND up.upid NOT LIKE 'UP%'
      AND (up.document_number IS NOT NULL OR up.document_number NOT LIKE 'TP-%')
      AND p.age IS NOT NULL
      AND p.age REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      ORDER BY date ASC
    `;
    const nodeWithoutLimit = SQL_FIND_PENDING_VISIT_ENCOUNTERS.replace(/\sLIMIT \?\s*$/i, '');
    assert.equal(normalizeSql(nodeWithoutLimit), normalizeSql(php));
  });

  it('visit encounter data query matches GetEncounterModel::getVisitEncounterData', () => {
    const php = `
      SELECT
        em.encount_id AS resource_encount_id,
        em.upid,
        em.client_id,
        em.date AS visit_date,
        p.beneficiary AS patient_name,
        'VISIT_ENCOUNTER' AS type_display,
        'Visit' AS display,
        'Visit Encounter' AS div_display,
        c.time AS order_time,
        u.fullname AS practitioner_name,
        'MS-PRAC-0025-001' AS practitioner_id,
        ad.hc AS facility_name,
        ad.fosaid AS location_id
      FROM encounter_main em
      INNER JOIN clientts c ON c.client_id = em.client_id AND c.date = em.date
      INNER JOIN patients p ON p.patient_id = em.client_id
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN address ad ON ad.address_id = 1
      WHERE em.rhie_status = 2 AND c.deleted = 0
      AND em.type = 'VISIT_ENCOUNTER' AND em.date = ? AND em.client_id = ?
      AND em.upid NOT LIKE 'UP%'
    `;
    assert.equal(normalizeSql(SQL_GET_VISIT_ENCOUNTER_DATA), normalizeSql(php));
  });

  it('mark visit uploaded matches UploadEncounterModel::markVisitUploaded', () => {
    const php = `
      UPDATE encounter_main SET rhie_status = 1, rhie_uploaded_at = NOW() WHERE encount_id = ?
    `;
    assert.equal(normalizeSql(SQL_MARK_VISIT_UPLOADED), normalizeSql(php));
  });
});
