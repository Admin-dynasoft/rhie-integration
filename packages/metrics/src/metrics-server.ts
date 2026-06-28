import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Logger } from '@rhie/logger';
import type { WorkerMetricsCollector } from './collector.js';
import type { MetricsStore } from './collector.js';

export interface MetricsHttpServerOptions {
  port: number;
  logger: Logger;
  collector: WorkerMetricsCollector;
  store?: MetricsStore;
}

export class MetricsHttpServer {
  private server: ReturnType<typeof createServer> | null = null;

  constructor(private readonly options: MetricsHttpServerOptions) {}

  start(): void {
    const { port, logger, collector, store } = this.options;

    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/metrics') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            workers: collector.getAll(),
            counters: store?.getAll() ?? {},
          }),
        );
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    this.server.listen(port, () => {
      logger.info({ event: 'metrics_server_start', port }, `Metrics server listening on :${port}`);
    });
  }

  stop(): void {
    this.server?.close();
    this.server = null;
  }
}
