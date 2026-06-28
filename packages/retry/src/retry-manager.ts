import type { RetryConfig } from '@rhie/config';
import type { Logger } from '@rhie/logger';

export class PermanentFailureError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PermanentFailureError';
  }
}

export interface RetryOptions {
  config: RetryConfig;
  logger?: Logger;
  operationName?: string;
  isRetryable?: (error: unknown) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: unknown;
  attempts: number;
  permanent: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof PermanentFailureError) {
    return false;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('network') ||
      message.includes('503') ||
      message.includes('502') ||
      message.includes('429')
    );
  }
  return false;
}

export class RetryManager {
  private readonly config: RetryConfig;
  private readonly logger?: Logger;
  private readonly operationName: string;
  private readonly isRetryable: (error: unknown) => boolean;

  constructor(options: RetryOptions) {
    this.config = options.config;
    this.logger = options.logger;
    this.operationName = options.operationName ?? 'operation';
    this.isRetryable = options.isRetryable ?? defaultIsRetryable;
  }

  async execute<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
    let lastError: unknown;
    let delay = this.config.initialDelayMs;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const result = await fn();
        return { success: true, result, attempts: attempt, permanent: false };
      } catch (error) {
        lastError = error;

        if (error instanceof PermanentFailureError) {
          this.logger?.error(
            { event: 'permanent_failure', operation: this.operationName, error: error.message },
            'Permanent failure — not retrying',
          );
          return { success: false, error, attempts: attempt, permanent: true };
        }

        const canRetry = attempt < this.config.maxAttempts && this.isRetryable(error);

        this.logger?.warn(
          {
            event: 'retry',
            operation: this.operationName,
            attempt,
            maxAttempts: this.config.maxAttempts,
            willRetry: canRetry,
            error: error instanceof Error ? error.message : String(error),
          },
          `${this.operationName} failed on attempt ${attempt}`,
        );

        if (!canRetry) {
          break;
        }

        await sleep(delay);
        delay = Math.min(delay * this.config.backoffMultiplier, this.config.maxDelayMs);
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: this.config.maxAttempts,
      permanent: false,
    };
  }
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const manager = new RetryManager(options);
  const result = await manager.execute(fn);

  if (!result.success) {
    throw result.error;
  }

  return result.result as T;
}

export function isPermanentFailure(error: unknown): boolean {
  return error instanceof PermanentFailureError;
}
