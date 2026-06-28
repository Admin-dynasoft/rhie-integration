import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pino, { type Logger, type LoggerOptions } from 'pino';
import type { LoggingConfig } from '@rhie/config';

export interface LoggerContext {
  service: string;
  facilityId?: string;
  databaseId?: string;
  workerId?: string;
  correlationId?: string;
}

const loggers = new Map<string, Logger>();
let fileStream: pino.DestinationStream | null = null;

function buildKey(context: LoggerContext): string {
  return [context.service, context.facilityId, context.databaseId, context.workerId]
    .filter(Boolean)
    .join(':');
}

function ensureLogDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function createFileStream(filePath: string): pino.DestinationStream {
  ensureLogDir(filePath);
  return pino.destination({ dest: filePath, sync: false, mkdir: true });
}

export function createLogger(context: LoggerContext, config?: LoggingConfig): Logger {
  const key = buildKey(context);

  if (loggers.has(key)) {
    const existing = loggers.get(key)!;
    if (context.correlationId) {
      return existing.child({ correlationId: context.correlationId });
    }
    return existing;
  }

  const options: LoggerOptions = {
    level: config?.level ?? process.env.LOG_LEVEL ?? 'info',
    base: {
      service: context.service,
      ...(context.facilityId && { facilityId: context.facilityId }),
      ...(context.databaseId && { databaseId: context.databaseId }),
      ...(context.workerId && { workerId: context.workerId }),
      ...(context.correlationId && { correlationId: context.correlationId }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  const usePretty = config?.prettyPrint || process.env.NODE_ENV === 'development';
  const useFile = config?.fileEnabled ?? false;

  if (useFile && config?.filePath) {
    if (!fileStream) {
      fileStream = createFileStream(config.filePath);
    }
  }

  let logger: Logger;

  if (usePretty) {
    logger = pino(
      options,
      pino.transport({
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
      }),
    );
  } else if (useFile && fileStream) {
    logger = pino(options, fileStream);
  } else {
    logger = pino(options);
  }

  loggers.set(key, logger);
  return logger;
}

export function getLogger(context: LoggerContext): Logger {
  return createLogger(context);
}

export function withCorrelationId(logger: Logger, correlationId: string): Logger {
  return logger.child({ correlationId });
}

export type { Logger };
