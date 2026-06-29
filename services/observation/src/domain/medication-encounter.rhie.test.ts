import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { AxiosInstance } from 'axios';
import type { Logger } from '@rhie/logger';
import { uploadShrResourceOnce, RhieAuthProvider } from '@rhie/rhie-client';

const silentLogger = {
  debug: mock.fn(),
  info: mock.fn(),
  warn: mock.fn(),
  error: mock.fn(),
  fatal: mock.fn(),
  trace: mock.fn(),
  child: () => silentLogger,
} as unknown as Logger;

const samplePayload = {
  resourceType: 'MedicationRequest',
  id: 'med-enc-1',
  subject: { reference: 'Patient/1234567890123456' },
};

describe('uploadShrResourceOnce for MedicationRequest (PHP send() parity)', () => {
  it('POSTs to /shr/MedicationRequest', async () => {
    const request = mock.fn(async () => ({
      status: 200,
      data: { resourceType: 'MedicationRequest' },
    }));
    const http = { request } as unknown as AxiosInstance;
    const authProvider = {
      getAuthHeaders: mock.fn(async () => ({ Authorization: 'Basic x' })),
    } as unknown as RhieAuthProvider;

    const result = await uploadShrResourceOnce(
      http,
      authProvider,
      'MedicationRequest',
      samplePayload,
      silentLogger,
    );

    assert.equal(request.mock.callCount(), 1);
    assert.equal(request.mock.calls[0].arguments[0].url, '/shr/MedicationRequest');
    assert.equal(request.mock.calls[0].arguments[0].method, 'POST');
    assert.equal(result.resourceType, 'MedicationRequest');
    assert.equal(result.success, true);
  });

  it('marks failure when HTTP status is not 200 or 201', async () => {
    const http = {
      request: mock.fn(async () => ({ status: 422, data: { error: 'validation' } })),
    } as unknown as AxiosInstance;
    const authProvider = {
      getAuthHeaders: mock.fn(async () => ({})),
    } as unknown as RhieAuthProvider;

    const result = await uploadShrResourceOnce(
      http,
      authProvider,
      'MedicationRequest',
      samplePayload,
      silentLogger,
    );

    assert.equal(result.success, false);
    assert.equal(result.httpCode, 422);
  });
});
