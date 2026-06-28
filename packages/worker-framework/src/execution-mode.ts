import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CoordinatorState, ProcessingMode } from '@rhie/config';
import { getConfig } from '@rhie/config';
import type { WorkerMode } from './abstract-worker.js';

let cachedState: CoordinatorState | null = null;
let lastReadAt = 0;
const CACHE_TTL_MS = 2000;

export function readCoordinatorState(forceRefresh = false): CoordinatorState | null {
  const now = Date.now();
  if (!forceRefresh && cachedState && now - lastReadAt < CACHE_TTL_MS) {
    return cachedState;
  }

  const statePath = resolve(process.cwd(), getConfig().coordinator.stateFilePath);

  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const content = readFileSync(statePath, 'utf-8');
    cachedState = JSON.parse(content) as CoordinatorState;
    lastReadAt = now;
    return cachedState;
  } catch {
    return null;
  }
}

export function invalidateCoordinatorStateCache(): void {
  cachedState = null;
  lastReadAt = 0;
}

export function getProcessingModeForFacility(facilityId: string): ProcessingMode {
  const state = readCoordinatorState();
  if (!state) {
    return 'online';
  }
  return state.facilities[facilityId]?.mode ?? state.globalMode;
}

export function shouldWorkerRun(mode: WorkerMode, facilityId?: string): boolean {
  const state = readCoordinatorState();

  if (!state) {
    return mode === 'online';
  }

  if (mode === 'local') {
    if (facilityId) {
      return getProcessingModeForFacility(facilityId) === 'local';
    }
    return state.globalMode === 'local';
  }

  if (mode === 'online') {
    if (facilityId) {
      const facilityMode = getProcessingModeForFacility(facilityId);
      return facilityMode === 'online';
    }
    return state.globalMode === 'online';
  }

  return false;
}

export function isStandby(facilityId?: string): boolean {
  if (!facilityId) {
    const state = readCoordinatorState();
    return state?.globalMode === 'standby';
  }
  return getProcessingModeForFacility(facilityId) === 'standby';
}

export class ExecutionModeGate {
  constructor(
    private readonly mode: WorkerMode,
    private readonly facilityId?: string,
  ) {}

  shouldRun(): boolean {
    if (isStandby(this.facilityId)) {
      return false;
    }
    return shouldWorkerRun(this.mode, this.facilityId);
  }

  getReason(): string {
    if (isStandby(this.facilityId)) {
      return 'standby — coordinator has disabled processing';
    }
    if (!shouldWorkerRun(this.mode, this.facilityId)) {
      return `${this.mode} workers inactive — coordinator mode differs`;
    }
    return 'active';
  }
}
