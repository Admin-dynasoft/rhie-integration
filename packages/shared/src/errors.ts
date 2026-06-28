export class RhieIntegrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'RhieIntegrationError';
  }
}

export class DatabaseError extends RhieIntegrationError {
  constructor(message: string, cause?: unknown) {
    super(message, 'DATABASE_ERROR', cause, true);
    this.name = 'DatabaseError';
  }
}

export class ApiError extends RhieIntegrationError {
  constructor(message: string, cause?: unknown, retryable = true) {
    super(message, 'API_ERROR', cause, retryable);
    this.name = 'ApiError';
  }
}

export class ConfigurationError extends RhieIntegrationError {
  constructor(message: string, cause?: unknown) {
    super(message, 'CONFIGURATION_ERROR', cause, false);
    this.name = 'ConfigurationError';
  }
}

export class ProcessingModeError extends RhieIntegrationError {
  constructor(message: string) {
    super(message, 'PROCESSING_MODE_ERROR', undefined, false);
    this.name = 'ProcessingModeError';
  }
}

export function wrapError(error: unknown, context: string): RhieIntegrationError {
  if (error instanceof RhieIntegrationError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return new RhieIntegrationError(`${context}: ${message}`, 'UNKNOWN_ERROR', error);
}
