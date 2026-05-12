/**
 * © 2026 Securerise Solutions Limited
 * Lead Architect: Joshua Joel A Okoth (securerise@outlook.com)
 *
 * PROPRIETARY AND CONFIDENTIAL: This code is the intellectual property of
 * Securerise Solutions Limited. Unauthorized copying or distribution
 * is strictly prohibited under the CC BY-NC-ND 4.0 International License.
 */

import { logger } from './logger';

export type HttpErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export type ApiErrorBody = {
  error: {
    code: HttpErrorCode;
    message: string;
    requestId: string;
    details?: unknown;
  };
};

export function makeRequestId(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: HttpErrorCode;
  public readonly requestId: string;
  public readonly details?: unknown;

  constructor(opts: {
    statusCode: number;
    code: HttpErrorCode;
    message: string;
    requestId?: string;
    details?: unknown;
  }) {
    super(opts.message);
    this.statusCode = opts.statusCode;
    this.code = opts.code;
    this.requestId = opts.requestId ?? makeRequestId();
    this.details = opts.details;
  }
}

export function toApiErrorBody(err: ApiError): ApiErrorBody {
  return {
    error: {
      code: err.code,
      message: err.message,
      requestId: err.requestId,
      ...(err.details !== undefined ? { details: err.details } : {}),
    },
  };
}

export function sendApiError(res: any, err: ApiError) {
  if (res.headersSent) return;
  return res.status(err.statusCode).json(toApiErrorBody(err));
}

export function asApiError(err: any): ApiError {
  if (err instanceof ApiError) return err;
  logger.error({ message: 'Unhandled error', error: err?.message ?? err });
  return new ApiError({
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'Internal Server Error',
  });
}

