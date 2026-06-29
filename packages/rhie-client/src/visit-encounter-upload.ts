import axios, { type AxiosRequestConfig } from 'axios';
import type { RhieApiResponse } from './client.js';
import { RhieAuthProvider, formatApiError, isAxiosError } from './auth.js';
import type { RhieConfig } from '@rhie/config';
import type { Logger } from '@rhie/logger';

export interface VisitEncounterUploadResult extends RhieApiResponse {
  endpoint: string;
  kind: string;
  encounterId: string;
  upid: string;
  httpCode?: number;
}

/**
 * Single-attempt Visit Encounter upload — matches PHP UploadVisitEncounterController::sendToHIE().
 * No retry. Success only on HTTP 200 or 201.
 */
export async function uploadVisitEncounterOnce(
  http: ReturnType<typeof axios.create>,
  authProvider: RhieAuthProvider,
  config: RhieConfig,
  payload: Record<string, unknown>,
  kind: 'visit' | 'referral',
  logger: Logger,
): Promise<VisitEncounterUploadResult> {
  const path =
    kind === 'referral' ? `${config.visitEncounterPath}/transfer` : config.visitEncounterPath;
  const encounterId = String(payload.id ?? '');
  const upid = String(
    (payload.subject as { identifier?: { value?: string } } | undefined)?.identifier?.value ?? '',
  );

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
        { event: 'visit_encounter_upload_success', path, httpStatus: response.status, encounterId },
        'Visit encounter upload succeeded',
      );
    } else {
      logger.error(
        {
          event: 'visit_encounter_upload_failed',
          path,
          httpStatus: response.status,
          encounterId,
          response: response.data,
        },
        'Visit encounter upload failed',
      );
    }

    return {
      success,
      endpoint: config.visitEncounterPath,
      kind,
      encounterId,
      upid,
      httpCode: response.status,
      statusCode: response.status,
      data: response.data,
      error: success ? undefined : formatApiError({ response, message: 'Request failed' }),
    };
  } catch (error) {
    const errorMessage = formatApiError(error);
    logger.error(
      { event: 'visit_encounter_upload_error', path, encounterId, error: errorMessage },
      'Visit encounter upload error',
    );
    return {
      success: false,
      endpoint: config.visitEncounterPath,
      kind,
      encounterId,
      upid,
      error: errorMessage,
      statusCode: isAxiosError(error) ? error.response?.status : undefined,
    };
  }
}
