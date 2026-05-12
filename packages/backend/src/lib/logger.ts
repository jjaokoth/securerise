/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 *
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of
 * Securerise Solutions Limited. Unauthorized copying or distribution
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */

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

