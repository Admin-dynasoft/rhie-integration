import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CoordinatorState, ProcessingMode } from '@rhie/config';
import { getConfig } from '@rhie/config';

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

export function getProcessingModeForFacility(facilityId: string): ProcessingMode {
  const state = readCoordinatorState();

  if (!state) {
    return 'online';
  }

  const facilityState = state.facilities[facilityId];
  if (facilityState) {
    return facilityState.mode;
  }

  return state.globalMode;
}

export function shouldProcessLocally(facilityId?: string): boolean {
  if (!facilityId) {
    const state = readCoordinatorState();
    return state?.globalMode === 'local';
  }
  return getProcessingModeForFacility(facilityId) === 'local';
}

export function shouldProcessOnline(facilityId: string): boolean {
  const mode = getProcessingModeForFacility(facilityId);
  return mode === 'online';
}

export function isInStandby(facilityId?: string): boolean {
  if (!facilityId) {
    const state = readCoordinatorState();
    return state?.globalMode === 'standby';
  }
  return getProcessingModeForFacility(facilityId) === 'standby';
}

export function invalidateCoordinatorStateCache(): void {
  cachedState = null;
  lastReadAt = 0;
}
