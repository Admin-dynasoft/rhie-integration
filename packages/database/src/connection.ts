import mysql, {
  type Pool,
  type PoolOptions,
  type RowDataPacket,
  type ResultSetHeader,
  type ExecuteValues,
} from 'mysql2/promise';
import type { DatabaseConfig } from '@rhie/config';
import type { Logger } from '@rhie/logger';

export type QueryResult<T> = T[];

export interface DatabaseConnectionOptions {
  config: DatabaseConfig;
  logger: Logger;
}

export class DatabaseConnection {
  private pool: Pool | null = null;
  private readonly config: DatabaseConfig;
  private readonly logger: Logger;

  constructor(options: DatabaseConnectionOptions) {
    this.config = options.config;
    this.logger = options.logger;
  }

  async connect(): Promise<void> {
    if (this.pool) {
      return;
    }

    const poolOptions: PoolOptions = {
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      connectionLimit: this.config.connectionLimit,
      connectTimeout: this.config.connectTimeoutMs,
      waitForConnections: true,
      enableKeepAlive: true,
    };

    this.pool = mysql.createPool(poolOptions);

    const connection = await this.pool.getConnection();
    connection.release();

    this.logger.info(
      {
        event: 'database_connected',
        databaseId: this.config.id,
        host: this.config.host,
        database: this.config.database,
      },
      `Connected to database: ${this.config.name}`,
    );
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.logger.info(
        { event: 'database_disconnected', databaseId: this.config.id },
        `Disconnected from database: ${this.config.name}`,
      );
    }
  }

  async query<T extends RowDataPacket[]>(
    sql: string,
    params?: unknown[],
  ): Promise<T> {
    if (!this.pool) {
      throw new Error(`Database not connected: ${this.config.id}`);
    }

    try {
      const [rows] = await this.pool.query<T>(sql, params);
      return rows;
    } catch (error) {
      this.logger.error(
        {
          event: 'database_error',
          databaseId: this.config.id,
          error: error instanceof Error ? error.message : String(error),
        },
        'Database query failed',
      );
      throw error;
    }
  }

  async execute(sql: string, params?: ExecuteValues): Promise<ResultSetHeader> {
    if (!this.pool) {
      throw new Error(`Database not connected: ${this.config.id}`);
    }

    try {
      const [result] = await this.pool.execute<ResultSetHeader>(sql, params);
      return result;
    } catch (error) {
      this.logger.error(
        {
          event: 'database_error',
          databaseId: this.config.id,
          error: error instanceof Error ? error.message : String(error),
        },
        'Database execute failed',
      );
      throw error;
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.query<RowDataPacket[]>('SELECT 1 AS ok');
      return true;
    } catch {
      return false;
    }
  }

  get id(): string {
    return this.config.id;
  }

  get name(): string {
    return this.config.name;
  }

  isConnected(): boolean {
    return this.pool !== null;
  }
}

export class DatabaseManager {
  private readonly connections = new Map<string, DatabaseConnection>();
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async register(config: DatabaseConfig): Promise<DatabaseConnection> {
    if (this.connections.has(config.id)) {
      return this.connections.get(config.id)!;
    }

    const connection = new DatabaseConnection({ config, logger: this.logger });
    await connection.connect();
    this.connections.set(config.id, connection);
    return connection;
  }

  get(id: string): DatabaseConnection | undefined {
    return this.connections.get(id);
  }

  getOrThrow(id: string): DatabaseConnection {
    const conn = this.connections.get(id);
    if (!conn) {
      throw new Error(`Database connection not registered: ${id}`);
    }
    return conn;
  }

  getAll(): DatabaseConnection[] {
    return Array.from(this.connections.values());
  }

  async disconnectAll(): Promise<void> {
    const disconnects = Array.from(this.connections.values()).map((c) => c.disconnect());
    await Promise.all(disconnects);
    this.connections.clear();
  }

  async pingAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const [id, conn] of this.connections) {
      results[id] = await conn.ping();
    }
    return results;
  }
}

export type { RowDataPacket, ResultSetHeader };
