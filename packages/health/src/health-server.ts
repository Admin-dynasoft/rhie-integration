import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Logger } from '@rhie/logger';
import { aggregateHealth } from './types.js';
import type { HealthRegistry } from './checks.js';

export interface HealthHttpServerOptions {
  port: number;
  logger: Logger;
  serviceName: string;
  registry: HealthRegistry;
  getWorkerMetrics?: () => Record<string, unknown>;
}

export class HealthHttpServer {
  private server: ReturnType<typeof createServer> | null = null;

  constructor(private readonly options: HealthHttpServerOptions) {}

  start(): void {
    const { port, logger, serviceName, registry, getWorkerMetrics } = this.options;

    this.server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/health' || req.url === '/healthz') {
        const components = await registry.runAll();
        const aggregated = aggregateHealth(components);
        const workerMetrics = getWorkerMetrics?.() ?? {};
        const httpStatus = aggregated.status === 'offline' ? 503 : 200;

        res.writeHead(httpStatus, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            service: serviceName,
            ...aggregated,
            workers: workerMetrics,
          }),
        );
        return;
      }

      if (req.url === '/ready') {
        const components = await registry.runAll();
        const aggregated = aggregateHealth(components);
        const ready = aggregated.status !== 'offline';

        res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ready, status: aggregated.status }));
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    this.server.listen(port, () => {
      logger.info({ event: 'health_server_start', port }, `Health server listening on :${port}`);
    });
  }

  stop(): void {
    this.server?.close();
    this.server = null;
  }
}
