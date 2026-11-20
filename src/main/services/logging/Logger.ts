/**
 * Simple structured logger for the main process.
 * Can later be swapped for winston / pino / electron-log.
 */

import type { Logger, LogLevel } from '../../../shared/interfaces/services';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let minLevel: LogLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

function format(level: LogLevel, context: string, msg: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const metaStr = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `[${ts}] [${level.toUpperCase()}] [${context}] ${msg}${metaStr}`;
}

export class ConsoleLogger implements Logger {
  constructor(private context: string = 'app') {}

  private log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
    const line = format(level, this.context, msg, meta);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }

  debug(msg: string, meta?: Record<string, unknown>) {
    this.log('debug', msg, meta);
  }
  info(msg: string, meta?: Record<string, unknown>) {
    this.log('info', msg, meta);
  }
  warn(msg: string, meta?: Record<string, unknown>) {
    this.log('warn', msg, meta);
  }
  error(msg: string, meta?: Record<string, unknown>) {
    this.log('error', msg, meta);
  }
  child(context: string): Logger {
    return new ConsoleLogger(`${this.context}:${context}`);
  }
}

export const rootLogger = new ConsoleLogger('ScreenStudio');

export function setLogLevel(level: LogLevel) {
  minLevel = level;
}
