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
  resourceType: 'Observation',
  id: 'obs-enc-1',
  subject: { reference: 'Patient/1234567890123456' },
};

describe('uploadShrResourceOnce endpoint selection (PHP send() parity for complaints)', () => {
  it('POSTs to /shr/Observation for complaint upload', async () => {
    const request = mock.fn(async (config: { url?: string; method?: string }) => ({
      status: 200,
      data: { resourceType: 'Observation' },
    }));
    const http = { request } as unknown as AxiosInstance;
    const authProvider = {
      getAuthHeaders: mock.fn(async () => ({ Authorization: 'Basic x' })),
    } as unknown as RhieAuthProvider;

    const result = await uploadShrResourceOnce(
      http,
      authProvider,
      'Observation',
      samplePayload,
      silentLogger,
    );

    assert.equal(request.mock.callCount(), 1);
    assert.equal(request.mock.calls[0].arguments[0].url, '/shr/Observation');
    assert.equal(request.mock.calls[0].arguments[0].method, 'POST');
    assert.equal(
      request.mock.calls[0].arguments[0].headers['Content-Type'],
      'application/fhir+json',
    );
    assert.equal(result.resourceType, 'Observation');
    assert.equal(result.success, true);
  });

  it('marks failure when HTTP status is not 200 or 201 (PHP parity — no retry)', async () => {
    const http = {
      request: mock.fn(async () => ({ status: 500, data: { error: 'server' } })),
    } as unknown as AxiosInstance;
    const authProvider = {
      getAuthHeaders: mock.fn(async () => ({})),
    } as unknown as RhieAuthProvider;

    const result = await uploadShrResourceOnce(
      http,
      authProvider,
      'Observation',
      samplePayload,
      silentLogger,
    );

    assert.equal(result.success, false);
    assert.equal(result.httpCode, 500);
    assert.equal(result.endpoint, '/shr/Observation');
  });

  it('accepts HTTP 201 as success', async () => {
    const http = {
      request: mock.fn(async () => ({ status: 201, data: { id: 'obs-enc-1' } })),
    } as unknown as AxiosInstance;
    const authProvider = {
      getAuthHeaders: mock.fn(async () => ({})),
    } as unknown as RhieAuthProvider;

    const result = await uploadShrResourceOnce(
      http,
      authProvider,
      'Observation',
      samplePayload,
      silentLogger,
    );

    assert.equal(result.success, true);
    assert.equal(result.httpCode, 201);
  });
});
