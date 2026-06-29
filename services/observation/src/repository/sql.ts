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
