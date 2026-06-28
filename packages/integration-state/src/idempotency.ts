export interface IdempotencyKeyParts {
  facilityCode: string;
  pipelineStage: string;
  entityType: string;
  entityKey: string;
}

/**
 * Builds a deterministic idempotency key for RHIE integration records.
 * Format: {facility}:{stage}:{entityType}:{entityKey}
 */
export function buildIdempotencyKey(parts: IdempotencyKeyParts): string {
  const sanitize = (value: string): string =>
    value.trim().replace(/\s+/g, '_').replace(/:/g, '-');

  return [
    sanitize(parts.facilityCode),
    sanitize(parts.pipelineStage),
    sanitize(parts.entityType),
    sanitize(parts.entityKey),
  ].join(':');
}

export function parseIdempotencyKey(key: string): IdempotencyKeyParts | null {
  const segments = key.split(':');
  if (segments.length < 4) {
    return null;
  }

  const [facilityCode, pipelineStage, entityType, ...entityKeyParts] = segments;
  return {
    facilityCode,
    pipelineStage,
    entityType,
    entityKey: entityKeyParts.join(':'),
  };
}
