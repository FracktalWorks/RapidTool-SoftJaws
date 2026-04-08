const isDev =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOGGING === 'true';

function makeLogger(level: string) {
  return (...args: unknown[]) => {
    if (!isDev) return;
    const prefix = `[SoftJaws:${level.toUpperCase()}]`;
    switch (level) {
      case 'debug':
        console.debug(prefix, ...args);
        break;
      case 'info':
        console.info(prefix, ...args);
        break;
      case 'warn':
        console.warn(prefix, ...args);
        break;
      case 'error':
      case 'critical':
        console.error(prefix, ...args);
        break;
      default:
        console.log(prefix, ...args);
    }
  };
}

export const logger = {
  debug: makeLogger('debug'),
  info: makeLogger('info'),
  warn: makeLogger('warn'),
  error: makeLogger('error'),
  critical: makeLogger('critical'),
};
