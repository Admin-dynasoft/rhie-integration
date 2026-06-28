import type { RequiredMedisoftTable } from './constants.js';

export type DiscoveryMode = 'auto' | 'local' | 'online';

export interface MySQLCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
}

export interface ValidatedMedisoftDatabase {
  database: string;
  facilityCode: string;
  facilityName: string;
  validatedTables: RequiredMedisoftTable[];
  centralFacilityId?: number;
}

export interface DiscoveredOnlineDatabase extends ValidatedMedisoftDatabase {
  id: string;
  host: string;
  port: number;
  user: string;
  password: string;
}

export interface DiscoveredEnvironment {
  version: 1;
  discoveredAt: string;
  connectionSignature: string;
  mode: DiscoveryMode;
  localDatabase: ValidatedMedisoftDatabase;
  onlineDatabases: DiscoveredOnlineDatabase[];
}

export interface EnvironmentDiscoveryOptions {
  credentials: MySQLCredentials;
  mode?: DiscoveryMode;
  centralDatabase?: string;
  excludeDatabases?: string[];
  cachePath?: string;
  selectedDatabase?: string;
  forceRediscover?: boolean;
  localDatabaseId?: string;
  connectionLimit?: number;
  connectTimeoutMs?: number;
}

export interface EnvironmentDiscoveryResult {
  localDatabase: ValidatedMedisoftDatabase;
  onlineDatabases: DiscoveredOnlineDatabase[];
  fromCache: boolean;
  cachePath: string;
}

export interface CentralFacilityRow {
  id: number;
  db_name: string;
  fosaid: string;
  db_host: string | null;
  db_user: string | null;
  db_password: string | null;
}
