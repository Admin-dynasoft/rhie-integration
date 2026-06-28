import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Logger } from '@rhie/logger';
import { getAllHealthSnapshots } from './health-monitor.js';

export interface HealthServerOptions {
  port: number;
  logger: Logger;
  serviceName: string;
  getAdditionalHealth?: () => Record<string, unknown>;
}

export function startHealthServer(options: HealthServerOptions): ReturnType<typeof createServer> {
  const { port, logger, serviceName, getAdditionalHealth } = options;

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/health' || req.url === '/healthz') {
      const snapshots = getAllHealthSnapshots();
      const additional = getAdditionalHealth?.() ?? {};
      const healthy = snapshots.every((s) => s.status !== 'error');

      res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          service: serviceName,
          healthy,
          timestamp: new Date().toISOString(),
          workers: snapshots,
          ...additional,
        }),
      );
      return;
    }

    if (req.url === '/metrics') {
      const snapshots = getAllHealthSnapshots();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ workers: snapshots }));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  server.listen(port, () => {
    logger.info({ event: 'health_server_start', port }, `Health server listening on port ${port}`);
  });

  return server;
}
