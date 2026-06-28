/** Integration state DDL — independent from Medisoft business tables */

export const SQL_CREATE_INTEGRATION_STATE = `
CREATE TABLE IF NOT EXISTS rhie_integration_state (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  facility_code VARCHAR(32) NOT NULL,
  pipeline_stage VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_key VARCHAR(255) NOT NULL,
  idempotency_key VARCHAR(512) NOT NULL,
  status ENUM('pending','processing','success','failed','dead_letter') NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  rhie_resource_id VARCHAR(255) NULL,
  rhie_resource_type VARCHAR(64) NULL,
  last_error_message TEXT NULL,
  last_attempt_at DATETIME NULL,
  last_success_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_idempotency_key (idempotency_key),
  KEY idx_facility_stage_status (facility_code, pipeline_stage, status),
  KEY idx_entity (entity_type, entity_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

export const SQL_CREATE_INTEGRATION_HISTORY = `
CREATE TABLE IF NOT EXISTS rhie_integration_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  integration_state_id BIGINT NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  message TEXT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_state_id (integration_state_id),
  CONSTRAINT fk_history_state
    FOREIGN KEY (integration_state_id) REFERENCES rhie_integration_state(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

export const SQL_CREATE_DEAD_LETTER = `
CREATE TABLE IF NOT EXISTS rhie_integration_dead_letter (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  integration_state_id BIGINT NOT NULL,
  facility_code VARCHAR(32) NOT NULL,
  pipeline_stage VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(512) NOT NULL,
  reason TEXT NOT NULL,
  payload JSON NULL,
  moved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_dead_letter_state (integration_state_id),
  KEY idx_facility_stage (facility_code, pipeline_stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

export const SCHEMA_STATEMENTS = [
  SQL_CREATE_INTEGRATION_STATE,
  SQL_CREATE_INTEGRATION_HISTORY,
  SQL_CREATE_DEAD_LETTER,
];

export const SQL_FIND_BY_IDEMPOTENCY_KEY = `
SELECT
  id,
  facility_code AS facilityCode,
  pipeline_stage AS pipelineStage,
  entity_type AS entityType,
  entity_key AS entityKey,
  idempotency_key AS idempotencyKey,
  status,
  retry_count AS retryCount,
  rhie_resource_id AS rhieResourceId,
  rhie_resource_type AS rhieResourceType,
  last_error_message AS lastErrorMessage,
  last_attempt_at AS lastAttemptAt,
  last_success_at AS lastSuccessAt,
  created_at AS createdAt,
  updated_at AS updatedAt
FROM rhie_integration_state
WHERE idempotency_key = ?
LIMIT 1
`;

export const SQL_UPSERT_PENDING = `
INSERT INTO rhie_integration_state (
  facility_code,
  pipeline_stage,
  entity_type,
  entity_key,
  idempotency_key,
  status,
  rhie_resource_type
) VALUES (?, ?, ?, ?, ?, 'pending', ?)
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP
`;

export const SQL_MARK_PROCESSING = `
UPDATE rhie_integration_state
SET status = 'processing',
    last_attempt_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE idempotency_key = ?
  AND status IN ('pending', 'failed')
`;

export const SQL_MARK_SUCCESS = `
UPDATE rhie_integration_state
SET status = 'success',
    rhie_resource_id = ?,
    last_success_at = CURRENT_TIMESTAMP,
    last_error_message = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE idempotency_key = ?
`;

export const SQL_MARK_FAILED = `
UPDATE rhie_integration_state
SET status = 'failed',
    retry_count = retry_count + 1,
    last_error_message = ?,
    last_attempt_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE idempotency_key = ?
`;

export const SQL_MARK_DEAD_LETTER = `
UPDATE rhie_integration_state
SET status = 'dead_letter',
    last_error_message = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE idempotency_key = ?
`;

export const SQL_INSERT_HISTORY = `
INSERT INTO rhie_integration_history (
  integration_state_id,
  event_type,
  status,
  message,
  metadata
) VALUES (?, ?, ?, ?, ?)
`;

export const SQL_INSERT_DEAD_LETTER = `
INSERT INTO rhie_integration_dead_letter (
  integration_state_id,
  facility_code,
  pipeline_stage,
  idempotency_key,
  reason,
  payload
) VALUES (?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  reason = VALUES(reason),
  payload = VALUES(payload),
  moved_at = CURRENT_TIMESTAMP
`;

export const SQL_FIND_BY_ID = `
SELECT id FROM rhie_integration_state WHERE idempotency_key = ? LIMIT 1
`;
