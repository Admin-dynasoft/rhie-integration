import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosError,
} from 'axios';
import type { RhieAuthConfig } from '@rhie/config';
import type { Logger } from '@rhie/logger';

export class RhieAuthProvider {
  private token: string | null = null;
  private tokenExpiresAt: number | null = null;

  constructor(
    private readonly authConfig: RhieAuthConfig,
    private readonly logger: Logger,
    private readonly httpClient: AxiosInstance,
  ) {}

  async getAuthHeaders(): Promise<Record<string, string>> {
    switch (this.authConfig.type) {
      case 'bearer': {
        const token = await this.resolveBearerToken();
        return { Authorization: `Bearer ${token}` };
      }
      case 'basic': {
        const credentials = Buffer.from(
          `${this.authConfig.username}:${this.authConfig.password}`,
        ).toString('base64');
        return { Authorization: `Basic ${credentials}` };
      }
      case 'oauth2': {
        const token = await this.fetchOAuthToken();
        return { Authorization: `Bearer ${token}` };
      }
      default:
        return {};
    }
  }

  private async resolveBearerToken(): Promise<string> {
    if (this.authConfig.token) {
      return this.authConfig.token;
    }
    throw new Error('Bearer token not configured');
  }

  private async fetchOAuthToken(): Promise<string> {
    if (this.token && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }

    if (!this.authConfig.tokenUrl || !this.authConfig.clientId || !this.authConfig.clientSecret) {
      throw new Error('OAuth2 configuration incomplete');
    }

    const response = await this.httpClient.post(this.authConfig.tokenUrl, {
      grant_type: 'client_credentials',
      client_id: this.authConfig.clientId,
      client_secret: this.authConfig.clientSecret,
    });

    this.token = response.data.access_token;
    const expiresIn = response.data.expires_in ?? 3600;
    this.tokenExpiresAt = Date.now() + expiresIn * 1000 - 60000;

    this.logger.debug({ event: 'oauth_token_refreshed' }, 'OAuth token refreshed');
    return this.token!;
  }
}

export function isAxiosError(error: unknown): error is AxiosError {
  return axios.isAxiosError(error);
}

export function formatApiError(error: unknown): string {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;
    return `HTTP ${status ?? 'unknown'}: ${JSON.stringify(data ?? error.message)}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export type { AxiosRequestConfig, AxiosError };
