import {
  CENTRAL_REGISTRY_DATABASES,
  MYSQL_SYSTEM_DATABASES,
} from './constants.js';

export function isSystemDatabase(name: string): boolean {
  return MYSQL_SYSTEM_DATABASES.has(name.toLowerCase());
}

export function isCentralRegistryDatabase(name: string, extraExcludes: string[] = []): boolean {
  const normalized = name.toLowerCase();
  if (CENTRAL_REGISTRY_DATABASES.has(normalized)) {
    return true;
  }
  return extraExcludes.some((entry) => entry.toLowerCase() === normalized);
}

export function filterCandidateDatabases(
  databaseNames: string[],
  options?: { excludeDatabases?: string[] },
): string[] {
  const exclude = options?.excludeDatabases ?? [];
  return databaseNames.filter(
    (name) =>
      !isSystemDatabase(name) &&
      !isCentralRegistryDatabase(name, exclude),
  );
}

export function buildConnectionSignature(host: string, port: number, user: string): string {
  return `${host}:${port}:${user}`;
}

export function sanitizeFacilityCode(value: string, fallbackDatabase: string): string {
  const trimmed = value.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }
  return fallbackDatabase.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || fallbackDatabase;
}

export function buildOnlineDatabaseId(centralFacilityId: number, facilityCode: string): string {
  const safeCode = facilityCode.replace(/[^a-zA-Z0-9_-]+/g, '-');
  return `online-${centralFacilityId}-${safeCode}`;
}
