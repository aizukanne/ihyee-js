// src/errors.ts
// Error classes for the ihyee SDK.

/** Base error for all ihyee API errors. */
export class IhyeeError extends Error {
  /** Machine-readable error code from the API. */
  readonly code: string;
  /** HTTP status code. */
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(`${code}: ${message}`);
    this.name = 'IhyeeError';
    this.code = code;
    this.statusCode = statusCode;
    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Raised on 401 (invalid/missing key) or 403 (key disabled). */
export class AuthError extends IhyeeError {
  constructor(code: string, message: string, statusCode: number = 401) {
    super(code, message, statusCode);
    this.name = 'AuthError';
  }
}

/** Raised on 429. Includes retryAfter if provided by the API. */
export class RateLimitError extends IhyeeError {
  /** Seconds to wait before retrying, if provided by the API. */
  readonly retryAfter: number | undefined;

  constructor(code: string, message: string, retryAfter?: number) {
    super(code, message, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/** Raised on 400 (validation error, invalid parameters). */
export class BadRequestError extends IhyeeError {
  constructor(code: string, message: string, statusCode: number = 400) {
    super(code, message, statusCode);
    this.name = 'BadRequestError';
  }
}

/** Raised on 502 (upstream fetch failed), 504 (render timeout), or other 5xx. */
export class ServerError extends IhyeeError {
  constructor(code: string, message: string, statusCode: number = 500) {
    super(code, message, statusCode);
    this.name = 'ServerError';
  }
}
