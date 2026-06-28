import axios, { type AxiosRequestConfig } from 'axios';
import type { RhieApiResponse } from './client.js';
import { RhieAuthProvider, formatApiError, isAxiosError } from './auth.js';
import type { RhieConfig } from '@rhie/config';
import type { Logger } from '@rhie/logger';

/**
 * Single-attempt Client Registry upload — matches PHP sendToHIE() exactly.
 * No retry. Success only on HTTP 200 or 201.
 */
export async function uploadClientRegistryOnce(
  http: ReturnType<typeof axios.create>,
  authProvider: RhieAuthProvider,
  config: RhieConfig,
  payload: unknown,
  logger: Logger,
): Promise<RhieApiResponse> {
  const path = config.clientRegistryPath;

  try {
    const authHeaders = await authProvider.getAuthHeaders();
    const requestConfig: AxiosRequestConfig = {
      method: 'POST',
      url: path,
      headers: {
        ...authHeaders,
        'Content-Type': 'application/fhir+json',
        Accept: 'application/fhir+json',
      },
      data: payload,
      validateStatus: () => true,
    };

    const response = await http.request(requestConfig);
    const success = response.status === 200 || response.status === 201;

    if (success) {
      logger.info(
        { event: 'upload_success', path, httpStatus: response.status },
        'Client Registry upload succeeded',
      );
      return {
        success: true,
        data: response.data,
        statusCode: response.status,
      };
    }

    logger.error(
      {
        event: 'upload_failed',
        path,
        httpStatus: response.status,
        response: response.data,
      },
      'Client Registry upload failed',
    );

    return {
      success: false,
      statusCode: response.status,
      error: formatApiError({ response, message: 'Request failed' }),
      data: response.data,
    };
  } catch (error) {
    const errorMessage = formatApiError(error);
    logger.error(
      { event: 'upload_failed', path, error: errorMessage },
      'Client Registry upload error',
    );
    return {
      success: false,
      error: errorMessage,
      statusCode: isAxiosError(error) ? error.response?.status : undefined,
    };
  }
}
