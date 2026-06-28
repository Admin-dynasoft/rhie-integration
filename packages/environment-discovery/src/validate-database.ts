import {
  REQUIRED_MEDISOFT_TABLES,
  type RequiredMedisoftTable,
} from './constants.js';
import { listTables } from './mysql-probe.js';
import type { MySQLCredentials, ValidatedMedisoftDatabase } from './types.js';
import { readFacilityIdentity } from './facility-identity.js';
import { EnvironmentDiscoveryError } from './errors.js';
import { sanitizeFacilityCode } from './helpers.js';

export interface DatabaseValidationResult {
  database: string;
  validatedTables: RequiredMedisoftTable[];
  missingTables: string[];
  isMedisoft: boolean;
}

export async function validateMedisoftDatabase(
  credentials: MySQLCredentials,
  database: string,
): Promise<DatabaseValidationResult> {
  const tables = await listTables(credentials, database);
  const missingTables = REQUIRED_MEDISOFT_TABLES.filter(
    (table) => !tables.has(table.toLowerCase()),
  );

  return {
    database,
    validatedTables: REQUIRED_MEDISOFT_TABLES.filter((table) =>
      tables.has(table.toLowerCase()),
    ),
    missingTables,
    isMedisoft: missingTables.length === 0,
  };
}

export async function inspectMedisoftDatabase(
  credentials: MySQLCredentials,
  database: string,
  centralFacilityId?: number,
): Promise<ValidatedMedisoftDatabase> {
  const validation = await validateMedisoftDatabase(credentials, database);
  if (!validation.isMedisoft) {
    throw new EnvironmentDiscoveryError(
      `Database "${database}" is missing required Medisoft tables: ${validation.missingTables.join(', ')}`,
    );
  }

  const identity = await readFacilityIdentity(credentials, database);

  return {
    database,
    facilityCode: sanitizeFacilityCode(identity.fosaid, database),
    facilityName: identity.facilityName.trim() || database,
    validatedTables: validation.validatedTables,
    centralFacilityId,
  };
}

export function formatCandidateList(candidates: ValidatedMedisoftDatabase[]): string {
  return candidates
    .map(
      (candidate) =>
        `  - ${candidate.database} (facility: ${candidate.facilityName}, code: ${candidate.facilityCode})`,
    )
    .join('\n');
}
