import type { Logger } from '@rhie/logger';
import type { AbstractWorker } from './abstract-worker.js';

type ShutdownHandler = () => Promise<void>;

export class GracefulShutdownManager {
  private handlers: ShutdownHandler[] = [];
  private shuttingDown = false;

  constructor(private readonly logger: Logger) {
    process.on('SIGINT', () => void this.shutdown('SIGINT'));
    process.on('SIGTERM', () => void this.shutdown('SIGTERM'));
  }

  register(handler: ShutdownHandler): void {
    this.handlers.push(handler);
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  private async shutdown(signal: string): Promise<void> {
    if (this.shuttingDown) {
      return;
    }
    this.shuttingDown = true;

    this.logger.info({ event: 'shutdown_start', signal }, `Graceful shutdown initiated (${signal})`);

    for (const handler of this.handlers.reverse()) {
      try {
        await handler();
      } catch (error) {
        this.logger.error(
          {
            event: 'shutdown_handler_error',
            error: error instanceof Error ? error.message : String(error),
          },
          'Shutdown handler failed',
        );
      }
    }

    this.logger.info({ event: 'shutdown_complete', signal }, 'Graceful shutdown complete');
    process.exit(0);
  }
}

export async function stopAllWorkers(workers: AbstractWorker[], logger: Logger): Promise<void> {
  logger.info({ event: 'stopping_workers', count: workers.length }, 'Stopping all workers');
  await Promise.all(workers.map((w) => w.stop()));
}
