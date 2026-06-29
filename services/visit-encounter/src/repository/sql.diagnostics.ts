/**
 * DIAGNOSTIC SQL ONLY — never used for batch selection or upload.
 * Mirrors batch filters in sql.ts to explain why rows are excluded.
 */

const VISIT_RHIE_STATUS_2_BASE = `
FROM encounter_main em
LEFT JOIN upid_patients up ON em.client_id = up.client_id
LEFT JOIN patients p ON em.client_id = p.patient_id
WHERE em.type IN ('VISIT_ENCOUNTER')
AND em.rhie_status = 2
`;

const E_TRANSFER_RHIE_STATUS_2_BASE = `
FROM encounter_main em
LEFT JOIN upid_patients up ON em.client_id = up.client_id
LEFT JOIN patients p ON em.client_id = p.patient_id
WHERE em.type IN ('E_TRANSFER')
AND em.rhie_status = 2
`;

/** Same predicates as SQL_FIND_PENDING_VISIT_ENCOUNTERS (without LIMIT). */
export const SQL_DIAG_VISIT_BATCH_ELIGIBLE_COUNT = `
SELECT COUNT(DISTINCT em.encount_id) AS count
FROM encounter_main em
LEFT JOIN upid_patients up ON em.client_id = up.client_id
LEFT JOIN patients p ON em.client_id = p.patient_id
WHERE type IN ('VISIT_ENCOUNTER')
AND em.rhie_status = 2 AND up.status = 2
AND up.upid NOT LIKE 'UP%'
AND (up.document_number IS NOT NULL OR up.document_number NOT LIKE 'TP-%')
AND p.age IS NOT NULL
AND p.age REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
`;

/** Same predicates as SQL_FIND_PENDING_E_TRANSFER_ENCOUNTERS (without LIMIT). */
export const SQL_DIAG_E_TRANSFER_BATCH_ELIGIBLE_COUNT = `
SELECT COUNT(DISTINCT em.encount_id) AS count
FROM encounter_main em
LEFT JOIN upid_patients up ON em.client_id = up.client_id
LEFT JOIN patients p ON em.client_id = p.patient_id
WHERE type IN ('E_TRANSFER')
AND em.rhie_status = 2 AND up.status = 2
AND up.upid NOT LIKE 'UP%'
AND (up.document_number IS NOT NULL OR up.document_number NOT LIKE 'TP-%')
AND p.age IS NOT NULL
AND p.age REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
`;

export const SQL_DIAG_VISIT_RHIE_STATUS_2_COUNT = `
SELECT COUNT(DISTINCT em.encount_id) AS count
${VISIT_RHIE_STATUS_2_BASE}
`;

export const SQL_DIAG_VISIT_BLOCKED_UPID_STATUS = `
SELECT COUNT(DISTINCT em.encount_id) AS count
${VISIT_RHIE_STATUS_2_BASE}
AND (up.status IS NULL OR up.status != 2)
`;

export const SQL_DIAG_VISIT_BLOCKED_UPID_PREFIX = `
SELECT COUNT(DISTINCT em.encount_id) AS count
${VISIT_RHIE_STATUS_2_BASE}
AND up.status = 2
AND up.upid LIKE 'UP%'
`;

export const SQL_DIAG_VISIT_BLOCKED_AGE = `
SELECT COUNT(DISTINCT em.encount_id) AS count
${VISIT_RHIE_STATUS_2_BASE}
AND up.status = 2
AND up.upid NOT LIKE 'UP%'
AND (up.document_number IS NOT NULL OR up.document_number NOT LIKE 'TP-%')
AND (p.age IS NULL OR p.age NOT REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
`;

export const SQL_DIAG_VISIT_BLOCKED_DOCUMENT_NUMBER = `
SELECT COUNT(DISTINCT em.encount_id) AS count
${VISIT_RHIE_STATUS_2_BASE}
AND up.status = 2
AND up.upid NOT LIKE 'UP%'
AND NOT (up.document_number IS NOT NULL OR up.document_number NOT LIKE 'TP-%')
AND p.age IS NOT NULL
AND p.age REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
`;

export const SQL_DIAG_E_TRANSFER_RHIE_STATUS_2_COUNT = `
SELECT COUNT(DISTINCT em.encount_id) AS count
${E_TRANSFER_RHIE_STATUS_2_BASE}
`;

export const SQL_DIAG_E_TRANSFER_BLOCKED_UPID_STATUS = `
SELECT COUNT(DISTINCT em.encount_id) AS count
${E_TRANSFER_RHIE_STATUS_2_BASE}
AND (up.status IS NULL OR up.status != 2)
`;
