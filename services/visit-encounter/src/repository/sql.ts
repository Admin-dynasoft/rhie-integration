/** Exact SQL from PHP upload_visit_encounters_batch.php and GetEncounterModel / UploadEncounterModel */

export const SQL_FIND_PENDING_VISIT_ENCOUNTERS = `
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
LIMIT ?
`;

export const SQL_GET_VISIT_ENCOUNTER_DATA = `
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

export const SQL_MARK_VISIT_UPLOADED = `
UPDATE encounter_main SET rhie_status = 1, rhie_uploaded_at = NOW() WHERE encount_id = ?
`;

export const SQL_FIND_PENDING_E_TRANSFER_ENCOUNTERS = `
SELECT DISTINCT
  em.client_id,
  up.upid,
  em.date,
  p.age,
  em.encount_id AS resource_encount_id
FROM encounter_main em
LEFT JOIN upid_patients up ON em.client_id = up.client_id
LEFT JOIN patients p ON em.client_id = p.patient_id
WHERE type IN ('E_TRANSFER')
AND em.rhie_status = 2 AND up.status = 2
AND up.upid NOT LIKE 'UP%'
AND (up.document_number IS NOT NULL OR up.document_number NOT LIKE 'TP-%')
AND p.age IS NOT NULL
AND p.age REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
ORDER BY date ASC
LIMIT ?
`;

export const SQL_GET_E_TRANSFER_ENCOUNTER_DATA = `
SELECT
  et.encount_id AS resource_encount_id,
  ve.encount_id AS reference_encount_id,
  et.upid,
  et.client_id,
  et.date AS visit_date,
  p.beneficiary AS patient_name,
  'TRANSFER_ENCOUNTER' AS type_display,
  'Transfer' AS display,
  'Transfer Encounter' AS div_display,
  c.time AS order_time,
  u.fullname AS practitioner_name,
  'MS-PRAC-0025-001' AS practitioner_id,
  ad.hc AS origin_facility_name,
  ad.hospital AS destination_facility_name,
  ad.fosaid AS origin_location_id
FROM encounter_main et
INNER JOIN encounter_main ve
  ON ve.client_id = et.client_id
  AND ve.date = et.date
  AND ve.type = 'VISIT_ENCOUNTER'
  AND ve.rhie_status = 1
INNER JOIN clientts c
  ON c.client_id = et.client_id
  AND c.date = et.date
INNER JOIN patients p
  ON p.patient_id = et.client_id
LEFT JOIN users u
  ON c.user_id = u.id
LEFT JOIN address ad
  ON ad.address_id = 1
WHERE et.rhie_status = 2
AND et.type = 'E_TRANSFER'
AND c.deleted = 0
AND et.date = ? AND et.client_id = ?
AND et.upid NOT LIKE 'UP%'
`;
