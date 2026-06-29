import axios, { type AxiosRequestConfig } from 'axios';
import type { RhieApiResponse } from './client.js';
import { RhieAuthProvider, formatApiError, isAxiosError } from './auth.js';
import type { Logger } from '@rhie/logger';

export interface ShrResourceUploadResult extends RhieApiResponse {
  endpoint: string;
  resourceType: string;
  resourceId: string;
  httpCode?: number;
}

/**
 * Single-attempt SHR FHIR upload — matches PHP UploadEncounterController::send() for type 'observ'.
 * POST {baseUrl}/shr/{resourceType}. No retry. Success only on HTTP 200 or 201.
 */
export async function uploadShrResourceOnce(
  http: ReturnType<typeof axios.create>,
  authProvider: RhieAuthProvider,
  resourceType: string,
  payload: Record<string, unknown>,
  logger: Logger,
): Promise<ShrResourceUploadResult> {
  const path = `/shr/${resourceType}`;
  const resourceId = String(payload.id ?? '');

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
        {
          event: 'shr_resource_upload_success',
          path,
          resourceType,
          httpStatus: response.status,
          resourceId,
        },
        'SHR resource upload succeeded',
      );
    } else {
      logger.error(
        {
          event: 'shr_resource_upload_failed',
          path,
          resourceType,
          httpStatus: response.status,
          resourceId,
          response: response.data,
        },
        'SHR resource upload failed',
      );
    }

    return {
      success,
      endpoint: path,
      resourceType,
      resourceId,
      httpCode: response.status,
      statusCode: response.status,
      data: response.data,
      error: success ? undefined : formatApiError({ response, message: 'Request failed' }),
    };
  } catch (error) {
    const errorMessage = formatApiError(error);
    logger.error(
      { event: 'shr_resource_upload_error', path, resourceType, resourceId, error: errorMessage },
      'SHR resource upload error',
    );
    return {
      success: false,
      endpoint: path,
      resourceType,
      resourceId,
      error: errorMessage,
      statusCode: isAxiosError(error) ? error.response?.status : undefined,
    };
  }
}
