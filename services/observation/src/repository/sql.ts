/** Exact SQL from PHP GetEncounterModel, UploadEncounterModel, and batch eligibility patterns */

export const SQL_FIND_PENDING_COMPLAINT_ENCOUNTERS = `
SELECT DISTINCT
  ep.client_id,
  ep.date,
  up.upid,
  ep.encount_id AS observation_encount_id
FROM encounter_patients ep
INNER JOIN encounter_main em
  ON ep.client_id = em.client_id
  AND ep.date = em.date
  AND em.type = 'VISIT_ENCOUNTER'
LEFT JOIN upid_patients up ON ep.client_id = up.client_id
LEFT JOIN patients p ON ep.client_id = p.patient_id
WHERE ep.type = 'complaint'
AND ep.rhie_status = 2
AND up.status = 2
AND up.upid NOT LIKE 'UP%'
AND (up.document_number IS NOT NULL OR up.document_number NOT LIKE 'TP-%')
AND p.age IS NOT NULL
AND p.age REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
AND em.upid NOT LIKE 'UP%'
ORDER BY ep.date ASC
LIMIT ?
`;

export const SQL_GET_COMPLAINT_ENCOUNTER_DATA = `
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

export const SQL_MARK_OBSERVATION_UPLOADED = `
UPDATE encounter_patients SET rhie_status = 1, rhie_uploaded_at = NOW() WHERE encount_id = ?
`;

export const SQL_FIND_PENDING_DIAGNOSIS_ENCOUNTERS = `
SELECT DISTINCT
  ep.client_id,
  ep.date,
  up.upid,
  ep.encount_id AS observation_encount_id
FROM encounter_patients ep
INNER JOIN encounter_main em
  ON ep.client_id = em.client_id
  AND ep.date = em.date
  AND em.type = 'VISIT_ENCOUNTER'
LEFT JOIN upid_patients up ON ep.client_id = up.client_id
LEFT JOIN patients p ON ep.client_id = p.patient_id
WHERE ep.type = 'diagnostic'
AND ep.rhie_status = 2
AND up.status = 2
AND up.upid NOT LIKE 'UP%'
AND (up.document_number IS NOT NULL OR up.document_number NOT LIKE 'TP-%')
AND p.age IS NOT NULL
AND p.age REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
AND em.upid NOT LIKE 'UP%'
ORDER BY ep.date ASC
LIMIT ?
`;

/** Exact SQL from PHP GetEncounterModel::getDiagEncounterData — note: no ep.rhie_status filter (PHP parity) */
export const SQL_GET_DIAGNOSIS_ENCOUNTER_DATA = `
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

export const SQL_FIND_PENDING_MEDICATION_ENCOUNTERS = `
SELECT DISTINCT
  ep.client_id,
  ep.date,
  up.upid,
  ep.encount_id AS observation_encount_id
FROM encounter_patients ep
INNER JOIN encounter_main em
  ON ep.client_id = em.client_id
  AND ep.date = em.date
  AND em.type = 'VISIT_ENCOUNTER'
INNER JOIN orders o
  ON o.order_id = ep.source_id
  AND o.client_id = em.client_id
  AND o.date = em.date
  AND o.type = 'med'
  AND o.deleted = 0
LEFT JOIN products pr ON pr.prod_id = o.item
LEFT JOIN upid_patients up ON ep.client_id = up.client_id
LEFT JOIN patients p ON ep.client_id = p.patient_id
WHERE ep.type = 'MEDICINE_ENCOUNTER'
AND ep.rhie_status = 2
AND pr.full_desc NOT LIKE '%inject%'
AND up.status = 2
AND up.upid NOT LIKE 'UP%'
AND (up.document_number IS NOT NULL OR up.document_number NOT LIKE 'TP-%')
AND p.age IS NOT NULL
AND p.age REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
AND em.upid NOT LIKE 'UP%'
ORDER BY ep.date ASC
LIMIT ?
`;

/** Exact SQL from PHP GetEncounterModel::getMedicationEncounterData */
export const SQL_GET_MEDICATION_ENCOUNTER_DATA = `
SELECT
  em.encount_id AS reference_encount_id,
  em.upid,
  em.client_id,
  em.date AS main_date,
  ep.encount_id AS observation_encount_id,
  ep.source_id,
  'Medication Encounter' AS main_display,
  'Medication_Request' AS display,
  'Medication' AS div_display,
  p.duration,
  p.posologie,
  o.quantity,
  o.item,
  o.time AS order_time,
  u.fullname AS practitioner_name,
  CONCAT(
    pr.full_desc, ' || ',
    COALESCE(p.posologie, ''), ' || ',
    IF(p.duration IS NOT NULL, CONCAT(p.duration, ' days'), ''), ' || ',
    o.quantity
  ) AS full_description,
  pr.code
FROM encounter_patients ep
INNER JOIN encounter_main em ON em.client_id = ep.client_id AND em.date = ep.date AND em.type = 'VISIT_ENCOUNTER'
INNER JOIN orders o ON o.order_id = ep.source_id AND o.client_id = em.client_id AND o.date = em.date AND o.type = 'med' AND o.deleted = 0
LEFT JOIN posologies p ON p.order_id = ep.source_id
LEFT JOIN products pr ON pr.prod_id = o.item
LEFT JOIN users u ON u.id = o.user
WHERE ep.type = 'MEDICINE_ENCOUNTER' AND ep.rhie_status = 2 AND em.date = ? AND em.client_id = ?
AND pr.full_desc NOT LIKE '%inject%'
AND em.upid NOT LIKE 'UP%'
`;

export const SQL_FIND_PENDING_LAB_RESULT_ENCOUNTERS = `
SELECT DISTINCT
  ep.client_id,
  ep.date,
  up.upid,
  ep.encount_id AS observation_encount_id
FROM encounter_patients ep
INNER JOIN encounter_main em
  ON ep.client_id = em.client_id
  AND ep.date = em.date
  AND em.type = 'VISIT_ENCOUNTER'
INNER JOIN lab_results lr
  ON lr.test_id = ep.source_id
  AND lr.client_id = em.client_id
  AND lr.date = em.date
  AND lr.deleted = 0
LEFT JOIN upid_patients up ON ep.client_id = up.client_id
LEFT JOIN patients p ON ep.client_id = p.patient_id
WHERE ep.type = 'lab'
AND ep.rhie_status = 2
AND up.status = 2
AND up.upid NOT LIKE 'UP%'
AND (up.document_number IS NOT NULL OR up.document_number NOT LIKE 'TP-%')
AND p.age IS NOT NULL
AND p.age REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
AND em.upid NOT LIKE 'UP%'
ORDER BY ep.date ASC
LIMIT ?
`;

/** Exact SQL from PHP GetEncounterModel::getLaboEncounterData */
export const SQL_GET_LAB_RESULT_ENCOUNTER_DATA = `
SELECT
  em.encount_id AS reference_encount_id,
  em.upid,
  em.client_id,
  em.date AS main_date,
  ep.encount_id AS observation_encount_id,
  ep.source_id,
  'Laboratory' AS main_display,
  'Laboratory' AS display,
  'Laboratory' AS div_display,
  a.act AS full_description,
  CASE WHEN lr.pos_neg_result = '1' THEN 'Positif'
  WHEN lr.pos_neg_result = '3' THEN 'Negatif'
  ELSE lr.comment END AS result,
  lr.time AS order_time,
  u.fullname AS practitioner_name,
  'Lab-000' AS code
FROM encounter_main em
INNER JOIN encounter_patients ep ON ep.client_id = em.client_id AND ep.date = em.date AND em.type = 'VISIT_ENCOUNTER'
INNER JOIN lab_results lr ON lr.test_id = ep.source_id AND lr.client_id = em.client_id AND lr.date = em.date AND lr.deleted = 0
LEFT JOIN acts a ON lr.exam_id = a.act_id
LEFT JOIN users u ON lr.lab_tech = u.id
WHERE ep.type = 'lab' AND ep.rhie_status = 2 AND em.date = ? AND em.client_id = ?
AND em.upid NOT LIKE 'UP%'
`;

export const SQL_FIND_PENDING_LAB_REQUEST_ENCOUNTERS = `
SELECT DISTINCT
  ep.client_id,
  ep.date,
  up.upid,
  ep.encount_id AS observation_encount_id
FROM encounter_patients ep
INNER JOIN encounter_main em
  ON ep.client_id = em.client_id
  AND ep.date = em.date
  AND em.type = 'VISIT_ENCOUNTER'
INNER JOIN orders o
  ON o.order_id = ep.source_id
  AND o.client_id = em.client_id
  AND o.date = em.date
  AND o.deleted = 0
LEFT JOIN upid_patients up ON ep.client_id = up.client_id
LEFT JOIN patients p ON ep.client_id = p.patient_id
WHERE ep.type = 'lab_request'
AND ep.rhie_status = 2
AND up.status = 2
AND up.upid NOT LIKE 'UP%'
AND (up.document_number IS NOT NULL OR up.document_number NOT LIKE 'TP-%')
AND p.age IS NOT NULL
AND p.age REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
AND em.upid NOT LIKE 'UP%'
ORDER BY ep.date ASC
LIMIT ?
`;

/** Exact SQL from PHP GetEncounterModel::getLabRequestEncounterData */
export const SQL_GET_LAB_REQUEST_ENCOUNTER_DATA = `
SELECT
  em.encount_id AS reference_encount_id,
  em.upid,
  em.client_id,
  em.date AS main_date,
  ep.encount_id AS observation_encount_id,
  ep.source_id,
  'Laboratory procedure' AS main_display,
  'Lab Request' AS display,
  'Lab Request' AS div_display,
  a.act AS full_description,
  o.time AS order_time,
  u.fullname AS practitioner_name,
  'Lab-000' AS code
FROM encounter_main em
INNER JOIN encounter_patients ep ON ep.client_id = em.client_id AND ep.date = em.date AND em.type = 'VISIT_ENCOUNTER'
INNER JOIN orders o ON o.order_id = ep.source_id AND o.client_id = em.client_id AND o.date = em.date AND o.deleted = 0
LEFT JOIN users u ON o.user = u.id
LEFT JOIN acts a ON o.item = a.act_id
WHERE ep.type = 'lab_request' AND ep.rhie_status = 2 AND em.date = ? AND em.client_id = ?
AND em.upid NOT LIKE 'UP%'
`;
