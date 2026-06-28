import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type { RhieConfig, RetryConfig } from '@rhie/config';
import type { Logger } from '@rhie/logger';
import { RetryManager } from '@rhie/retry';
import { RhieAuthProvider, formatApiError, isAxiosError } from './auth.js';

export interface RhieClientOptions {
  config: RhieConfig;
  retryConfig: RetryConfig;
  logger: Logger;
}

export interface RhieApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export class RhieClient {
  private readonly http: AxiosInstance;
  private readonly authProvider: RhieAuthProvider;
  private readonly retryManager: RetryManager;
  private readonly logger: Logger;
  private readonly config: RhieConfig;

  constructor(options: RhieClientOptions) {
    this.config = options.config;
    this.logger = options.logger;

    this.http = axios.create({
      baseURL: options.config.baseUrl,
      timeout: options.config.timeoutMs,
      headers: { 'Content-Type': 'application/json' },
    });

    this.authProvider = new RhieAuthProvider(options.config.auth, this.logger, this.http);
    this.retryManager = new RetryManager({
      config: options.retryConfig,
      logger: this.logger,
      operationName: 'rhie-api',
    });
  }

  async request<T>(method: string, path: string, data?: unknown): Promise<RhieApiResponse<T>> {
    const result = await this.retryManager.execute(async () => {
      const authHeaders = await this.authProvider.getAuthHeaders();
      const requestConfig: AxiosRequestConfig = {
        method,
        url: path,
        headers: authHeaders,
        data,
      };

      const response = await this.http.request<T>(requestConfig);
      return response.data;
    });

    if (result.success) {
      this.logger.info(
        { event: 'upload_success', method, path },
        `RHIE API call succeeded: ${method} ${path}`,
      );
      return { success: true, data: result.result };
    }

    const errorMessage = formatApiError(result.error);
    this.logger.error(
      {
        event: 'upload_failed',
        method,
        path,
        error: errorMessage,
        attempts: result.attempts,
      },
      `RHIE API call failed: ${method} ${path}`,
    );

    return {
      success: false,
      error: errorMessage,
      statusCode: isAxiosError(result.error) ? result.error.response?.status : undefined,
    };
  }

  // API method stubs — business logic mapping will be implemented in service layer
  async uploadClientRegistry(payload: unknown): Promise<RhieApiResponse> {
    return this.request('POST', this.config.clientRegistryPath, payload);
  }

  async generateEncounterId(payload: unknown): Promise<RhieApiResponse> {
    return this.request('POST', this.config.encounterIdPath, payload);
  }

  async uploadVisitEncounter(payload: unknown): Promise<RhieApiResponse> {
    return this.request('POST', this.config.visitEncounterPath, payload);
  }

  async uploadTransferEncounter(payload: unknown): Promise<RhieApiResponse> {
    return this.request('POST', this.config.transferEncounterPath, payload);
  }

  async uploadObservation(payload: unknown): Promise<RhieApiResponse> {
    return this.request('POST', this.config.observationPath, payload);
  }
}

export function createRhieClient(options: RhieClientOptions): RhieClient {
  return new RhieClient(options);
}
