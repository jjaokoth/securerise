/*
  Simple structured logger placeholder.
  Replace/extend with the real KratimsLogger / eTIMS-compliant logger if available.
*/

type LogLevel = 'info' | 'warn' | 'error';

function format(message: unknown): string {
  if (typeof message === 'string') return message;
  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

function log(level: LogLevel, payload: unknown) {
  // eslint-disable-next-line no-console
  console[level === 'warn' ? 'warn' : level](format(payload));
}

export const logger = {
  info: (payload: unknown) => log('info', payload),
  warn: (payload: unknown) => log('warn', payload),
  error: (payload: unknown) => log('error', payload),
};

