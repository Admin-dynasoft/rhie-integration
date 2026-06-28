/** Exact SQL from PHP EncounterModel and EncounterController */

export const SQL_VISIT_ENCOUNTERS = `
SELECT c.date, c.time, c.client_id, u.upid, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
FROM clientts c
JOIN upid_patients u ON c.client_id = u.patient_id
LEFT JOIN referral r ON c.client_id = r.client_id AND DATE(r.referral_date) = c.date
WHERE c.rhie_status = 0 AND c.date BETWEEN ? AND CURRENT_DATE() AND c.deleted = 0
AND u.upid NOT LIKE 'UP%'
ORDER BY c.date, c.client_id, c.time
`;

export const SQL_TRANSFER_ENCOUNTERS = `
SELECT c.date, c.time, c.client_id, u.upid, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
FROM clientts c
JOIN upid_patients u ON c.client_id = u.patient_id
LEFT JOIN referral r ON c.client_id = r.client_id AND DATE(r.referral_date) = c.date
WHERE c.rhie_status = 1 AND c.date BETWEEN ? AND CURRENT_DATE() AND c.deleted = 0
AND u.upid NOT LIKE 'UP%'
ORDER BY c.date, c.client_id, c.time
`;

export const SQL_ORDERS_ENCOUNTERS = `
SELECT o.order_id, o.date, o.time, o.client_id, u.upid, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
FROM orders o
JOIN upid_patients u ON o.client_id = u.client_id
LEFT JOIN referral r ON o.client_id = r.client_id AND DATE(r.referral_date) = o.date
WHERE o.type = ? AND o.rhie_status = 0 AND o.date BETWEEN ? AND CURRENT_DATE() AND o.deleted = 0
AND u.upid NOT LIKE 'UP%'
ORDER BY o.date, o.client_id, o.time
`;

export const SQL_LAB_RESULTS = `
SELECT l.test_id, l.date, l.time, l.client_id, u.upid, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
FROM lab_results l
JOIN upid_patients u ON l.client_id = u.patient_id
LEFT JOIN referral r ON l.client_id = r.client_id AND DATE(r.referral_date) = l.date
WHERE l.rhie_status = 0 AND l.date BETWEEN ? AND CURRENT_DATE()
AND u.upid NOT LIKE 'UP%'
ORDER BY l.date, l.client_id, l.time
`;

export const SQL_LAB_REQUEST = `
SELECT o.order_id, o.date, o.time, o.client_id, u.upid, a.act, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
FROM orders o
INNER JOIN acts a ON o.item = a.act_id
JOIN upid_patients u ON o.client_id = u.patient_id
LEFT JOIN referral r ON o.client_id = r.client_id AND DATE(r.referral_date) = o.date
WHERE o.rhie_status = 0 AND o.date BETWEEN ? AND CURRENT_DATE() AND o.deleted = 0 AND o.type = 'laboratoire'
AND u.upid NOT LIKE 'UP%'
ORDER BY o.date, o.client_id, o.time
`;

export const SQL_DIAG_ENCOUNTERS = `
WITH ranked_diags AS (
    SELECT
      u.upid,
      dc.client_id,
      dc.id AS source_id,
      dc.date AS source_date,
      d.english AS diagnosis,
      LENGTH(COALESCE(d.english, '')) AS diag_length,
      ROW_NUMBER() OVER (
          PARTITION BY dc.client_id
          ORDER BY LENGTH(COALESCE(d.english, '')) DESC
      ) AS rn, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
    FROM diag_client dc
    JOIN upid_patients u ON dc.client_id = u.patient_id
    INNER JOIN diags d ON dc.diag_id = d.id
    LEFT JOIN referral r ON dc.client_id = r.client_id AND DATE(r.referral_date) = dc.date
    WHERE dc.rhie_status = 0 AND reference_reason IS NULL AND dc.date BETWEEN ? AND CURRENT_DATE()
    AND u.upid NOT LIKE 'UP%'
    )
    SELECT upid, client_id, source_id, source_date, diagnosis, referral
    FROM ranked_diags
    WHERE rn = 1
`;

export const SQL_COMPLAINT_ENCOUNTERS = `
SELECT
      upid,
      patient_id,
      vital_sign_id AS source_id,
      date AS source_date,
      referral
FROM (
    SELECT
      u.upid,
      vs.patient_id,
      vs.vital_sign_id,
      vs.date,
      CASE
        WHEN r.id IS NOT NULL THEN TRUE
        ELSE FALSE
      END AS referral,
      ROW_NUMBER() OVER (
        PARTITION BY u.upid
        ORDER BY vs.date ASC, vs.vital_sign_id ASC
      ) AS rn
    FROM vital_sign vs
    JOIN upid_patients u
      ON vs.patient_id = u.patient_id
    LEFT JOIN referral r
      ON vs.patient_id = r.client_id
      AND DATE(r.referral_date) = vs.date
    WHERE vs.vital_id = 9
    AND vs.rhie_status = 0
    AND vs.date BETWEEN ? AND CURRENT_DATE()
    AND u.upid NOT LIKE 'UP%'
) AS filtered
WHERE rn = 1
`;

export const SQL_VITAL_SIGN_ENCOUNTERS = `
SELECT u.upid, vs.patient_id, vs.vital_sign_id AS source_id, vs.date AS source_date, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
FROM vital_sign vs
JOIN upid_patients u ON vs.patient_id = u.patient_id
LEFT JOIN referral r ON vs.patient_id = r.client_id AND DATE(r.referral_date) = vs.date
WHERE vs.vital_id IN (1,2,3,8,9,11,12,20,27,28,29,30) AND vs.rhie_status = 0 AND vs.date BETWEEN ? AND CURRENT_DATE()
AND u.upid NOT LIKE 'UP%'
`;

export const SQL_NCD_VITAL = `
SELECT u.upid, nc.client_id, nc.id AS source_id, DATE(nc.date) AS source_date, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
FROM ncds nc
JOIN upid_patients u ON nc.client_id = u.client_id
LEFT JOIN referral r ON nc.client_id = r.client_id AND DATE(r.referral_date) = nc.date
WHERE nc.vitael_id IN (1,2,3,5,11,12,13,15,17,20,21) AND nc.rhie_status = 0 AND DATE(nc.date) BETWEEN ? AND CURRENT_DATE()
AND u.upid NOT LIKE 'UP%'
`;

export const SQL_NCD_PLAINTES = `
SELECT u.upid, nc.client_id, nc.id AS source_id, DATE(nc.date) AS source_date, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
FROM ncds nc
JOIN upid_patients u ON nc.client_id = u.client_id
LEFT JOIN referral r ON nc.client_id = r.client_id AND DATE(r.referral_date) = nc.date
WHERE nc.vitael_id = 18 AND nc.rhie_status = 0 AND DATE(nc.date) BETWEEN ? AND CURRENT_DATE()
AND u.upid NOT LIKE 'UP%'
`;

export const SQL_NCD_DIAGNOSTIC = `
SELECT u.upid, nc.client_id, nc.id AS source_id, DATE(nc.date) AS source_date, CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
FROM ncds nc
JOIN upid_patients u ON nc.client_id = u.client_id
LEFT JOIN referral r ON nc.client_id = r.client_id AND DATE(r.referral_date) = nc.date
WHERE nc.vitael_id = 19 AND nc.rhie_status = 0 AND DATE(nc.date) BETWEEN ? AND CURRENT_DATE()
AND u.upid NOT LIKE 'UP%'
`;

export const SQL_REFERRAL_ENCOUNTERS = `
SELECT
      u.upid,
      dc.client_id,
      dc.id AS source_id,
      dc.referral_date AS source_date
    FROM referral dc
    JOIN upid_patients u ON dc.client_id = u.patient_id
    WHERE dc.rhie_status = 0 AND dc.referral_reason_id IS NOT NULL AND DATE(dc.referral_date) BETWEEN ? AND CURRENT_DATE() AND dc.deleted = 0
    AND u.upid NOT LIKE 'UP%'
    ORDER BY dc.referral_date, dc.client_id, dc.referral_date
`;

export const SQL_INSERT_MAIN_ENCOUNTER = `
INSERT INTO encounter_main
(
    encount_id,
    type,
    upid,
    client_id,
    date,
    time,
    rhie_status,
    rhie_uploaded_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
    rhie_status = VALUES(rhie_status),
    rhie_uploaded_at = VALUES(rhie_uploaded_at)
`;

export const SQL_INSERT_PATIENT_ENCOUNTER = `
INSERT INTO encounter_patients
(
  encount_id,
  type,
  upid,
  client_id,
  source_id,
  source_table,
  date,
  time,
  rhie_status,
  rhie_uploaded_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export const SQL_CHECK_MAIN_ENCOUNTER = `
SELECT 1
FROM encounter_main
WHERE upid = ?
AND client_id = ?
AND date = ?
AND type = ?
LIMIT 1
`;

export const SQL_MARK_VISIT = `
UPDATE clientts
SET rhie_status = 1
WHERE client_id = ?
`;

export const SQL_MARK_ORDER = `
UPDATE orders
SET rhie_status = 1
WHERE order_id = ?
`;

export const SQL_MARK_LAB = `
UPDATE lab_results
SET rhie_status = 1
WHERE test_id = ?
`;

export const SQL_MARK_DIAG = `
UPDATE diag_client
SET rhie_status = 1
WHERE client_id = ?
AND date = ?
`;

export const SQL_MARK_COMPLAINT = `
UPDATE vital_sign
SET rhie_status = 1
WHERE patient_id = ?
AND vital_id = 9
AND date = ?
`;

export const SQL_MARK_VITAL_SIGN = `
UPDATE vital_sign
SET rhie_status = 1
WHERE patient_id = ?
AND date = ?
`;

export const SQL_MARK_NCD = `
UPDATE ncds
SET rhie_status = 1
WHERE client_id = ?
AND date = ?
`;
