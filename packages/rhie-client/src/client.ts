import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type { RhieConfig, RetryConfig } from '@rhie/config';
import type { Logger } from '@rhie/logger';
import { RetryManager } from '@rhie/retry';
import { RhieAuthProvider, formatApiError, isAxiosError, isSuccessStatus } from './auth.js';

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

export interface RhieRequestOptions {
  contentType?: string;
  accept?: string;
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

    this.authProvider = new RhieAuthProvider(options.config.auth, this.logger, axios.create());

    this.http = axios.create({
      baseURL: options.config.baseUrl,
      timeout: options.config.timeoutMs,
      auth: this.authProvider.getAxiosAuth(),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });

    this.retryManager = new RetryManager({
      config: options.retryConfig,
      logger: this.logger,
      operationName: 'rhie-api',
    });
  }

  async ping(): Promise<boolean> {
    try {
      await this.http.get('/', { timeout: 5000, validateStatus: () => true });
      return true;
    } catch {
      return false;
    }
  }

  async request<T>(
    method: string,
    path: string,
    data?: unknown,
    options?: RhieRequestOptions,
  ): Promise<RhieApiResponse<T>> {
    const result = await this.retryManager.execute(async () => {
      const authHeaders = await this.authProvider.getAuthHeaders();
      const requestConfig: AxiosRequestConfig = {
        method,
        url: path,
        headers: {
          ...authHeaders,
          ...(options?.contentType && { 'Content-Type': options.contentType }),
          ...(options?.accept && { Accept: options.accept }),
        },
        data,
        validateStatus: () => true,
      };

      const response = await this.http.request<T>(requestConfig);

      if (!isSuccessStatus(response.status)) {
        throw new Error(formatApiError({ response, message: 'Request failed' }));
      }

      return response.data;
    });

    if (result.success) {
      this.logger.info({ event: 'rhie_request_success', method, path }, `RHIE API succeeded: ${method} ${path}`);
      return { success: true, data: result.result };
    }

    const errorMessage = formatApiError(result.error);
    this.logger.error(
      {
        event: 'rhie_request_failed',
        method,
        path,
        error: errorMessage,
        attempts: result.attempts,
        permanent: result.permanent,
      },
      `RHIE API failed: ${method} ${path}`,
    );

    return {
      success: false,
      error: errorMessage,
      statusCode: isAxiosError(result.error) ? result.error.response?.status : undefined,
    };
  }

  async uploadFhirResource(path: string, payload: unknown): Promise<RhieApiResponse> {
    return this.request('POST', path, payload, {
      contentType: 'application/fhir+json',
      accept: 'application/fhir+json',
    });
  }

  async uploadClientRegistry(payload: unknown): Promise<RhieApiResponse> {
    return this.uploadFhirResource(this.config.clientRegistryPath, payload);
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
