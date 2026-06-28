/** Exact SQL from PHP Client Registry implementation */

export const SQL_FIND_PENDING_CLIENTS_WITH_REFERRAL = `
SELECT DISTINCT up.patient_id
FROM upid_patients up
INNER JOIN referral r
    ON up.patient_id = r.client_id
INNER JOIN patients p
    ON up.patient_id = p.patient_id
WHERE up.status IN (0, 1, 3)
  AND up.upid NOT LIKE 'UP%'
  AND up.document_number IS NOT NULL
  AND up.document_number NOT LIKE 'TP-%'
  AND p.age IS NOT NULL
  AND p.age REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
ORDER BY up.patient_id ASC
LIMIT ?
`;

export const SQL_FIND_PENDING_CLIENTS_WITHOUT_REFERRAL = `
SELECT DISTINCT up.patient_id
FROM upid_patients up
INNER JOIN patients p
    ON up.patient_id = p.patient_id
WHERE up.status IN (0, 1, 3)
  AND up.upid NOT LIKE 'UP%'
  AND up.document_number IS NOT NULL
  AND up.document_number NOT LIKE 'TP-%'
  AND p.age IS NOT NULL
  AND p.age REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
ORDER BY up.patient_id ASC
LIMIT ?
`;

export const SQL_GET_UPIDS_BY_CLIENT = `
SELECT DISTINCT u.upid
FROM upid_patients u
WHERE u.client_id = ?
  AND u.status IN (0, 1, 3)
  AND u.upid NOT LIKE 'UP%'
ORDER BY u.upid ASC
`;

export const SQL_GET_CLIENT_DATA_BY_UPID = `
SELECT
    u.upid AS UPID,
    u.document_number AS nida,
    c.beneficiary AS full_names,
    c.family_name AS last_name,
    c.given_name AS first_name,
    c.sex AS gender,
    c.marital_status AS marital_status,
    c.tel AS phone,
    c.age AS birthdate,
    u.status AS rhie_status,
    p.province AS state,
    p.province_id AS state_id,
    d.district AS district,
    s.sector AS sector,
    ce.cell AS cell,
    CONCAT(d.district, ', ', s.sector, ', ', ce.cell) AS line,
    CASE WHEN r.id IS NOT NULL THEN TRUE ELSE FALSE END AS referral
FROM upid_patients u
INNER JOIN patients c ON u.patient_id = c.patient_id
INNER JOIN districts_client d ON c.district = d.district_id
INNER JOIN provinces p ON d.province_id = p.province_id
INNER JOIN sectors_client s ON s.sector_id = c.sector AND s.district_id = d.district_id
INNER JOIN cells_client ce ON ce.cell_id = c.cellule AND ce.sector_id = s.sector_id
LEFT JOIN referral r ON c.patient_id = r.client_id
WHERE u.upid = ?
  AND u.status IN (0, 1, 3)
  AND u.upid NOT LIKE 'UP%'
LIMIT 1
`;

export const SQL_UPDATE_UPID_STATUS = `
UPDATE upid_patients
SET status = ?
WHERE upid = ?
`;

export const SQL_MARK_CLIENT_AS_FAILED = `
UPDATE upid_patients
SET status = 3
WHERE client_id = ?
`;
