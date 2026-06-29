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

describe('uploadShrResourceOnce for laboratory (PHP send() parity)', () => {
  it('POSTs lab results to /shr/Observation', async () => {
    const request = mock.fn(async () => ({ status: 200, data: {} }));
    const http = { request } as unknown as AxiosInstance;
    const authProvider = {
      getAuthHeaders: mock.fn(async () => ({})),
    } as unknown as RhieAuthProvider;

    const result = await uploadShrResourceOnce(
      http,
      authProvider,
      'Observation',
      { resourceType: 'Observation', id: 'lab-1' },
      silentLogger,
    );

    assert.equal(request.mock.calls[0].arguments[0].url, '/shr/Observation');
    assert.equal(result.success, true);
  });

  it('POSTs lab requests to /shr/ServiceRequest', async () => {
    const request = mock.fn(async () => ({ status: 201, data: {} }));
    const http = { request } as unknown as AxiosInstance;
    const authProvider = {
      getAuthHeaders: mock.fn(async () => ({})),
    } as unknown as RhieAuthProvider;

    const result = await uploadShrResourceOnce(
      http,
      authProvider,
      'ServiceRequest',
      { resourceType: 'ServiceRequest', id: 'lab-req-1' },
      silentLogger,
    );

    assert.equal(request.mock.calls[0].arguments[0].url, '/shr/ServiceRequest');
    assert.equal(result.success, true);
  });
});
