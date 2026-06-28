import type {
  DiscoveredEnvironment,
  DiscoveredOnlineDatabase,
  EnvironmentDiscoveryOptions,
  EnvironmentDiscoveryResult,
  ValidatedMedisoftDatabase,
} from './types.js';
import { EnvironmentDiscoveryError } from './errors.js';
import { selectLocalDatabase } from './selection.js';
import {
  buildConnectionSignature,
  buildOnlineDatabaseId,
  filterCandidateDatabases,
  sanitizeFacilityCode,
} from './helpers.js';
import {
  assertCacheMatchesConnection,
  loadDiscoveredEnvironment,
  resolveCachePath,
  saveDiscoveredEnvironment,
} from './cache.js';
import { centralRegistryAvailable, readCentralFacilities } from './facility-identity.js';
import { databaseExists, listDatabases, wrapMySQLError } from './mysql-probe.js';
import {
  inspectMedisoftDatabase,
  validateMedisoftDatabase,
} from './validate-database.js';

async function scanLocalCandidates(
  credentials: EnvironmentDiscoveryOptions['credentials'],
  excludeDatabases: string[],
): Promise<ValidatedMedisoftDatabase[]> {
  const databaseNames = filterCandidateDatabases(await listDatabases(credentials), {
    excludeDatabases,
  });

  const candidates: ValidatedMedisoftDatabase[] = [];

  for (const database of databaseNames) {
    const validation = await validateMedisoftDatabase(credentials, database);
    if (!validation.isMedisoft) {
      continue;
    }

    try {
      candidates.push(await inspectMedisoftDatabase(credentials, database));
    } catch {
      // Skip databases that fail identity lookup.
    }
  }

  return candidates;
}

async function discoverOnlineDatabases(
  credentials: EnvironmentDiscoveryOptions['credentials'],
  centralDatabase: string,
): Promise<DiscoveredOnlineDatabase[]> {
  const facilities = await readCentralFacilities(credentials, centralDatabase);
  if (facilities.length === 0) {
    return [];
  }

  const discovered: DiscoveredOnlineDatabase[] = [];

  for (const facility of facilities) {
    const host = facility.db_host?.trim() || credentials.host;
    const user = facility.db_user?.trim() || credentials.user;
    const password = facility.db_password ?? credentials.password;
    const facilityCredentials = {
      host,
      port: credentials.port,
      user,
      password,
    };

    const exists = await databaseExists(facilityCredentials, facility.db_name);
    if (!exists) {
      continue;
    }

    const inspected = await inspectMedisoftDatabase(
      facilityCredentials,
      facility.db_name,
      facility.id,
    );

    discovered.push({
      ...inspected,
      id: buildOnlineDatabaseId(facility.id, sanitizeFacilityCode(facility.fosaid, facility.db_name)),
      host,
      port: credentials.port,
      user,
      password,
    });
  }

  if (discovered.length === 0) {
    throw new EnvironmentDiscoveryError(
      `Central registry "${centralDatabase}" lists facilities, but none of the referenced Medisoft databases could be validated.`,
    );
  }

  return discovered;
}

async function validateCachedEnvironment(
  cached: DiscoveredEnvironment,
  credentials: EnvironmentDiscoveryOptions['credentials'],
): Promise<boolean> {
  const localExists = await databaseExists(credentials, cached.localDatabase.database);
  if (!localExists) {
    return false;
  }

  for (const online of cached.onlineDatabases) {
    const onlineCredentials = {
      host: online.host,
      port: online.port,
      user: online.user,
      password: online.password,
    };
    const exists = await databaseExists(onlineCredentials, online.database);
    if (!exists) {
      return false;
    }
  }

  return true;
}

export async function discoverEnvironment(
  options: EnvironmentDiscoveryOptions,
): Promise<EnvironmentDiscoveryResult> {
  const mode = options.mode ?? 'auto';
  const centralDatabase = options.centralDatabase ?? 'medisoft_hie';
  const excludeDatabases = options.excludeDatabases ?? [];
  const cachePath = resolveCachePath(options.cachePath ?? './data/discovered-environment.json');
  const connectionSignature = buildConnectionSignature(
    options.credentials.host,
    options.credentials.port,
    options.credentials.user,
  );
  const forceRediscover =
    options.forceRediscover ?? process.env.FORCE_REDISCOVER === '1';

  if (!forceRediscover) {
    const cached = loadDiscoveredEnvironment(cachePath);
    if (cached) {
      assertCacheMatchesConnection(cached, connectionSignature);
      const stillValid = await validateCachedEnvironment(cached, options.credentials);
      if (stillValid) {
        return {
          localDatabase: cached.localDatabase,
          onlineDatabases: cached.onlineDatabases,
          fromCache: true,
          cachePath,
        };
      }
    }
  }

  try {

    let onlineDatabases: DiscoveredOnlineDatabase[] = [];
    let localCandidates: ValidatedMedisoftDatabase[] = [];

    const shouldDiscoverOnline = mode === 'auto' || mode === 'online';
    const shouldDiscoverLocal = mode === 'auto' || mode === 'local';

    if (shouldDiscoverOnline) {
      const registryAvailable = await centralRegistryAvailable(
        options.credentials,
        centralDatabase,
      );

      if (registryAvailable) {
        onlineDatabases = await discoverOnlineDatabases(options.credentials, centralDatabase);
      } else if (mode === 'online') {
        throw new EnvironmentDiscoveryError(
          `Online discovery mode requires central registry database "${centralDatabase}" with health_facilities rows.`,
        );
      }
    }

    if (shouldDiscoverLocal) {
      localCandidates = await scanLocalCandidates(options.credentials, excludeDatabases);
    }

    const cachedSelection = loadDiscoveredEnvironment(cachePath)?.localDatabase.database;
    const localDatabase = selectLocalDatabase(localCandidates, {
      selectedDatabase: options.selectedDatabase,
      cachedDatabase: cachedSelection,
    });

    const environment: DiscoveredEnvironment = {
      version: 1,
      discoveredAt: new Date().toISOString(),
      connectionSignature,
      mode,
      localDatabase,
      onlineDatabases,
    };

    saveDiscoveredEnvironment(cachePath, environment);

    return {
      localDatabase,
      onlineDatabases,
      fromCache: false,
      cachePath,
    };
  } catch (error) {
    throw wrapMySQLError(error, 'Environment discovery failed');
  }
}

export {
  filterCandidateDatabases,
  isSystemDatabase,
  isCentralRegistryDatabase,
} from './helpers.js';
export { REQUIRED_MEDISOFT_TABLES, MYSQL_SYSTEM_DATABASES } from './constants.js';
export { formatCandidateList } from './validate-database.js';
