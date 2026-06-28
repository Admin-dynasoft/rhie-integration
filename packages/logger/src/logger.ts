import pino, { type Logger, type LoggerOptions } from 'pino';
import type { LoggingConfig } from '@rhie/config';

export interface LoggerContext {
  service: string;
  facilityId?: string;
  databaseId?: string;
  workerId?: string;
}

const loggers = new Map<string, Logger>();

function buildKey(context: LoggerContext): string {
  return [context.service, context.facilityId, context.databaseId, context.workerId]
    .filter(Boolean)
    .join(':');
}

export function createLogger(
  context: LoggerContext,
  config?: LoggingConfig,
): Logger {
  const key = buildKey(context);

  if (loggers.has(key)) {
    return loggers.get(key)!;
  }

  const options: LoggerOptions = {
    level: config?.level ?? process.env.LOG_LEVEL ?? 'info',
    base: {
      service: context.service,
      ...(context.facilityId && { facilityId: context.facilityId }),
      ...(context.databaseId && { databaseId: context.databaseId }),
      ...(context.workerId && { workerId: context.workerId }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  const transport =
    config?.prettyPrint || process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined;

  const logger = transport ? pino(options, pino.transport(transport)) : pino(options);

  loggers.set(key, logger);
  return logger;
}

export function getLogger(context: LoggerContext): Logger {
  return createLogger(context);
}

export type { Logger };
