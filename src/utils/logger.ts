/**
 * Simple structured logger
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '#888',
  info: '#0078d4',
  warn: '#ff9800',
  error: '#f44336',
};

function log(level: LogLevel, module: string, message: string, data?: unknown) {
  const color = LOG_COLORS[level];
  const prefix = `%c[${module}]`;

  if (data !== undefined) {
    console[level](prefix, `color: ${color}; font-weight: bold`, message, data);
  } else {
    console[level](prefix, `color: ${color}; font-weight: bold`, message);
  }
}

export const logger = {
  debug: (module: string, message: string, data?: unknown) =>
    log('debug', module, message, data),
  info: (module: string, message: string, data?: unknown) =>
    log('info', module, message, data),
  warn: (module: string, message: string, data?: unknown) =>
    log('warn', module, message, data),
  error: (module: string, message: string, data?: unknown) =>
    log('error', module, message, data),
};
