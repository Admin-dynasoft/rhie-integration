export { EnvironmentDiscoveryError } from './errors.js';
export { discoverEnvironment } from './discoverer.js';
export {
  filterCandidateDatabases,
  isSystemDatabase,
  isCentralRegistryDatabase,
  buildConnectionSignature,
  sanitizeFacilityCode,
} from './helpers.js';
export {
  validateMedisoftDatabase,
  inspectMedisoftDatabase,
  formatCandidateList,
} from './validate-database.js';
export {
  readFacilityIdentity,
  readCentralFacilities,
  centralRegistryAvailable,
} from './facility-identity.js';
export {
  loadDiscoveredEnvironment,
  saveDiscoveredEnvironment,
  resolveCachePath,
} from './cache.js';
export type {
  DiscoveryMode,
  MySQLCredentials,
  ValidatedMedisoftDatabase,
  DiscoveredOnlineDatabase,
  DiscoveredEnvironment,
  EnvironmentDiscoveryOptions,
  EnvironmentDiscoveryResult,
  CentralFacilityRow,
} from './types.js';
export { REQUIRED_MEDISOFT_TABLES, MYSQL_SYSTEM_DATABASES } from './constants.js';
