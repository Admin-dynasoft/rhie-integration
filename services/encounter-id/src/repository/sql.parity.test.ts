import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SQL_VISIT_ENCOUNTERS,
  SQL_TRANSFER_ENCOUNTERS,
  SQL_ORDERS_ENCOUNTERS,
  SQL_LAB_RESULTS,
  SQL_LAB_REQUEST,
  SQL_DIAG_ENCOUNTERS,
  SQL_COMPLAINT_ENCOUNTERS,
  SQL_VITAL_SIGN_ENCOUNTERS,
  SQL_NCD_VITAL,
  SQL_NCD_PLAINTES,
  SQL_NCD_DIAGNOSTIC,
  SQL_REFERRAL_ENCOUNTERS,
  SQL_INSERT_MAIN_ENCOUNTER,
  SQL_INSERT_PATIENT_ENCOUNTER,
  SQL_CHECK_MAIN_ENCOUNTER,
  SQL_MARK_VISIT,
  SQL_MARK_ORDER,
  SQL_MARK_LAB,
  SQL_MARK_DIAG,
  SQL_MARK_COMPLAINT,
  SQL_MARK_VITAL_SIGN,
  SQL_MARK_NCD,
} from './sql.js';

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

describe('SQL parity with PHP EncounterModel / EncounterController', () => {
  it('visit query matches PHP generateEncountersVisit', () => {
    const php = `
      SELECT c.date, c.time, c.client_id, u.upid, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
      FROM clientts c
      JOIN upid_patients u ON c.client_id = u.patient_id
      LEFT JOIN referral r ON c.client_id = r.client_id AND DATE(r.referral_date) = c.date
      WHERE c.rhie_status = 0 AND c.date BETWEEN ? AND CURRENT_DATE() AND c.deleted = 0
      AND u.upid NOT LIKE 'UP%'
      ORDER BY c.date, c.client_id, c.time
    `;
    assert.equal(normalizeSql(SQL_VISIT_ENCOUNTERS), normalizeSql(php));
  });

  it('transfer query matches PHP generateEncountersTransfer rhie_status = 1', () => {
    assert.match(normalizeSql(SQL_TRANSFER_ENCOUNTERS), /c\.rhie_status = 1/);
    assert.doesNotMatch(normalizeSql(SQL_TRANSFER_ENCOUNTERS), /c\.rhie_status = 0/);
  });

  it('insert main encounter matches PHP ON DUPLICATE KEY UPDATE', () => {
    assert.match(normalizeSql(SQL_INSERT_MAIN_ENCOUNTER), /on duplicate key update/);
    assert.match(normalizeSql(SQL_INSERT_MAIN_ENCOUNTER), /rhie_status = values\(rhie_status\)/);
  });

  it('insert patient encounter targets encounter_patients table', () => {
    assert.match(normalizeSql(SQL_INSERT_PATIENT_ENCOUNTER), /insert into encounter_patients/);
    assert.doesNotMatch(normalizeSql(SQL_INSERT_PATIENT_ENCOUNTER), /on duplicate key update/);
  });

  it('mark statements match PHP EncounterModel', () => {
    assert.equal(
      normalizeSql(SQL_MARK_VISIT),
      normalizeSql('UPDATE clientts SET rhie_status = 1 WHERE client_id = ?'),
    );
    assert.equal(
      normalizeSql(SQL_MARK_ORDER),
      normalizeSql('UPDATE orders SET rhie_status = 1 WHERE order_id = ?'),
    );
    assert.equal(
      normalizeSql(SQL_MARK_LAB),
      normalizeSql('UPDATE lab_results SET rhie_status = 1 WHERE test_id = ?'),
    );
    assert.equal(
      normalizeSql(SQL_MARK_DIAG),
      normalizeSql('UPDATE diag_client SET rhie_status = 1 WHERE client_id = ? AND date = ?'),
    );
    assert.equal(
      normalizeSql(SQL_MARK_COMPLAINT),
      normalizeSql(
        'UPDATE vital_sign SET rhie_status = 1 WHERE patient_id = ? AND vital_id = 9 AND date = ?',
      ),
    );
    assert.equal(
      normalizeSql(SQL_MARK_VITAL_SIGN),
      normalizeSql('UPDATE vital_sign SET rhie_status = 1 WHERE patient_id = ? AND date = ?'),
    );
    assert.equal(
      normalizeSql(SQL_MARK_NCD),
      normalizeSql('UPDATE ncds SET rhie_status = 1 WHERE client_id = ? AND date = ?'),
    );
  });

  it('NCD vital filter uses vitael_id IN list from PHP', () => {
    assert.match(
      normalizeSql(SQL_NCD_VITAL),
      /nc\.vitael_id in \(1,2,3,5,11,12,13,15,17,20,21\)/,
    );
  });

  it('NCD plaintes and diagnostic use vitael_id 18 and 19', () => {
    assert.match(normalizeSql(SQL_NCD_PLAINTES), /nc\.vitael_id = 18/);
    assert.match(normalizeSql(SQL_NCD_DIAGNOSTIC), /nc\.vitael_id = 19/);
  });

  it('diag query uses ranked_diags CTE with rn = 1', () => {
    assert.match(normalizeSql(SQL_DIAG_ENCOUNTERS), /with ranked_diags as/);
    assert.match(normalizeSql(SQL_DIAG_ENCOUNTERS), /where rn = 1/);
    assert.match(normalizeSql(SQL_DIAG_ENCOUNTERS), /reference_reason is null/);
  });

  it('complaint query partitions by upid with vital_id = 9', () => {
    assert.match(normalizeSql(SQL_COMPLAINT_ENCOUNTERS), /partition by u\.upid/);
    assert.match(normalizeSql(SQL_COMPLAINT_ENCOUNTERS), /vs\.vital_id = 9/);
  });

  it('lab request joins acts and filters type laboratoire', () => {
    assert.match(normalizeSql(SQL_LAB_REQUEST), /inner join acts a on o\.item = a\.act_id/);
    assert.match(normalizeSql(SQL_LAB_REQUEST), /o\.type = 'laboratoire'/);
  });

  it('referral batch query filters referral_reason_id IS NOT NULL', () => {
    assert.match(normalizeSql(SQL_REFERRAL_ENCOUNTERS), /dc\.referral_reason_id is not null/);
  });

  it('check main encounter matches PHP columns (limit 1 is harmless addition)', () => {
    const php = `
      SELECT 1 FROM encounter_main
      WHERE upid = ? AND client_id = ? AND date = ? AND type = ?
    `;
    assert.ok(normalizeSql(SQL_CHECK_MAIN_ENCOUNTER).startsWith(normalizeSql(php)));
  });

  it('orders and lab result queries preserve PHP join keys', () => {
    assert.match(normalizeSql(SQL_ORDERS_ENCOUNTERS), /o\.client_id = u\.client_id/);
    assert.match(normalizeSql(SQL_LAB_RESULTS), /l\.client_id = u\.patient_id/);
    assert.match(normalizeSql(SQL_VITAL_SIGN_ENCOUNTERS), /vs\.vital_id in \(1,2,3,8,9,11,12,20,27,28,29,30\)/);
  });
});
