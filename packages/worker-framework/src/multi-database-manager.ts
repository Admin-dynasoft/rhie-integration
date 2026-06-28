import type {
  DatabaseConfig,
  LocalDatabaseConfig,
  OnlineDatabaseConfig,
  PlatformConfig,
} from '@rhie/config';
import { getConfig, getEnabledOnlineDatabases } from '@rhie/config';
import { DatabaseManager, type DatabaseConnection } from '@rhie/database';
import type { Logger } from '@rhie/logger';
import { DatabaseHealthCheck, globalHealthRegistry } from '@rhie/health';
import type { WorkerMode } from './abstract-worker.js';

export interface DatabaseTarget {
  config: DatabaseConfig;
  mode: WorkerMode;
  facilityId?: string;
  facilityCode?: string;
}

export class MultiDatabaseManager {
  private readonly dbManager: DatabaseManager;
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.dbManager = new DatabaseManager(logger);
  }

  async initialize(platformConfig?: PlatformConfig): Promise<void> {
    const config = platformConfig ?? getConfig();

    await this.dbManager.register(config.localDatabase);
    globalHealthRegistry.register(
      new DatabaseHealthCheck(config.localDatabase.id, this.dbManager.getOrThrow(config.localDatabase.id)),
    );

    for (const db of getEnabledOnlineDatabases(config)) {
      try {
        await this.dbManager.register(db);
        globalHealthRegistry.register(
          new DatabaseHealthCheck(db.id, this.dbManager.getOrThrow(db.id)),
        );
      } catch (error) {
        this.logger.warn(
          {
            event: 'online_db_register_failed',
            databaseId: db.id,
            error: error instanceof Error ? error.message : String(error),
          },
          `Failed to register online database: ${db.name}`,
        );
      }
    }
  }

  getConnection(id: string): DatabaseConnection | undefined {
    return this.dbManager.get(id);
  }

  getConnectionOrThrow(id: string): DatabaseConnection {
    return this.dbManager.getOrThrow(id);
  }

  getTargetsForMode(mode: WorkerMode, platformConfig?: PlatformConfig): DatabaseTarget[] {
    const config = platformConfig ?? getConfig();

    if (mode === 'local') {
      return [
        {
          config: config.localDatabase,
          mode: 'local',
        },
      ];
    }

    return getEnabledOnlineDatabases(config).map((db: OnlineDatabaseConfig) => ({
      config: db,
      mode: 'online' as WorkerMode,
      facilityId: db.facilityCode,
      facilityCode: db.facilityCode,
    }));
  }

  getLocalDatabase(): LocalDatabaseConfig {
    return getConfig().localDatabase;
  }

  getOnlineDatabases(): OnlineDatabaseConfig[] {
    return getEnabledOnlineDatabases();
  }

  async pingAll(): Promise<Record<string, boolean>> {
    return this.dbManager.pingAll();
  }

  async reconnect(id: string): Promise<void> {
    const existing = this.dbManager.get(id);
    if (existing) {
      await existing.disconnect();
    }
    const config = getConfig();
    const dbConfig =
      config.localDatabase.id === id
        ? config.localDatabase
        : config.onlineDatabases.find((d) => d.id === id);

    if (dbConfig) {
      await this.dbManager.register(dbConfig);
      this.logger.info({ event: 'database_reconnected', databaseId: id }, 'Database reconnected');
    }
  }

  async disconnectAll(): Promise<void> {
    await this.dbManager.disconnectAll();
  }

  getManager(): DatabaseManager {
    return this.dbManager;
  }
}
