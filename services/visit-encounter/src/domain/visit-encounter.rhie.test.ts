import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { AxiosInstance } from 'axios';
import type { RhieConfig } from '@rhie/config';
import type { Logger } from '@rhie/logger';
import { uploadVisitEncounterOnce, RhieAuthProvider } from '@rhie/rhie-client';

const silentLogger = {
  debug: mock.fn(),
  info: mock.fn(),
  warn: mock.fn(),
  error: mock.fn(),
  fatal: mock.fn(),
  trace: mock.fn(),
  child: () => silentLogger,
} as unknown as Logger;

const rhieConfig: RhieConfig = {
  baseUrl: 'https://devhie.moh.gov.rw:5000',
  timeoutMs: 30000,
  auth: { type: 'basic', username: 'test', password: 'test' },
  clientRegistryPath: '/clientregistry/Patient',
  encounterIdPath: '/encounters/id',
  visitEncounterPath: '/shr/Encounter',
  transferEncounterPath: '/encounters/transfer',
  observationPath: '/observations',
};

const samplePayload = {
  id: 'enc-1',
  subject: { identifier: { value: '1234567890123456' } },
};

describe('uploadVisitEncounterOnce endpoint selection (PHP sendToHIE parity)', () => {
  it('POSTs to /shr/Encounter for kind=visit', async () => {
    const request = mock.fn(async (config: { url?: string; method?: string }) => ({
      status: 200,
      data: { resourceType: 'Encounter' },
    }));
    const http = { request } as unknown as AxiosInstance;
    const authProvider = {
      getAuthHeaders: mock.fn(async () => ({ Authorization: 'Basic x' })),
    } as unknown as RhieAuthProvider;

    const result = await uploadVisitEncounterOnce(
      http,
      authProvider,
      rhieConfig,
      samplePayload,
      'visit',
      silentLogger,
    );

    assert.equal(request.mock.callCount(), 1);
    assert.equal(request.mock.calls[0].arguments[0].url, '/shr/Encounter');
    assert.equal(request.mock.calls[0].arguments[0].method, 'POST');
    assert.equal(result.kind, 'visit');
    assert.equal(result.success, true);
  });

  it('POSTs to /shr/Encounter/transfer for kind=referral (E_TRANSFER)', async () => {
    const request = mock.fn(async () => ({
      status: 201,
      data: { resourceType: 'Encounter' },
    }));
    const http = { request } as unknown as AxiosInstance;
    const authProvider = {
      getAuthHeaders: mock.fn(async () => ({ Authorization: 'Basic x' })),
    } as unknown as RhieAuthProvider;

    const result = await uploadVisitEncounterOnce(
      http,
      authProvider,
      rhieConfig,
      samplePayload,
      'referral',
      silentLogger,
    );

    assert.equal(request.mock.callCount(), 1);
    assert.equal(request.mock.calls[0].arguments[0].url, '/shr/Encounter/transfer');
    assert.equal(result.kind, 'referral');
    assert.equal(result.success, true);
  });

  it('marks failure when HTTP status is not 200 or 201 (PHP parity — no retry)', async () => {
    const http = {
      request: mock.fn(async () => ({ status: 500, data: { error: 'server' } })),
    } as unknown as AxiosInstance;
    const authProvider = {
      getAuthHeaders: mock.fn(async () => ({})),
    } as unknown as RhieAuthProvider;

    const result = await uploadVisitEncounterOnce(
      http,
      authProvider,
      rhieConfig,
      samplePayload,
      'visit',
      silentLogger,
    );

    assert.equal(result.success, false);
    assert.equal(result.httpCode, 500);
  });
});
