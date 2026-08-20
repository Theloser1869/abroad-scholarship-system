import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/// The one JSON error shape every endpoint returns, per 02_API_FOUNDATION.md
/// "error contract". Documented in docs/api/API_CONVENTIONS.md. `details` is reserved for
/// class-validator's field-level errors; any OTHER extra property a service throws (e.g.
/// `candidates`, `lockedUntil`, `allowedTransitions`, `openTaskCount`) is passed through
/// as-is at the top level of `error` — see the `extra` handling in `normalize()`.
export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
    [extra: string]: unknown;
  };
}

const RESERVED_KEYS = new Set(['code', 'message', 'statusCode', 'error']);

@Catch()
export class ErrorContractFilter implements ExceptionFilter {
  private readonly logger = new Logger('ErrorContractFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, code, message, details, extra } = this.normalize(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`[${req.requestId}] ${message}`, exception instanceof Error ? exception.stack : undefined);
    }

    const body: ErrorResponseBody = {
      error: {
        code,
        message,
        requestId: req.requestId,
        ...(details !== undefined ? { details } : {}),
        ...extra,
      },
    };
    res.status(status).json(body);
  }

  private normalize(exception: unknown): { status: number; code: string; message: string; details?: unknown; extra: Record<string, unknown> } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        const body = response as Record<string, unknown>;
        const code = typeof body.code === 'string' ? body.code : ErrorContractFilter.codeForStatus(status);
        const message = typeof body.message === 'string' ? body.message : exception.message;
        // class-validator's ValidationPipe puts the field-level errors here.
        const details = Array.isArray(body.message) ? body.message : body.details;
        // Every other property a service put on the thrown exception body (candidates,
        // lockedUntil, allowedTransitions, openTaskCount, ...) — a 500-internal-error
        // response never carries these, only a deliberately-thrown HttpException with a
        // structured body does, so passing them all through is safe: nothing here can
        // leak internal state a caller shouldn't see (see 500-path below, which stays
        // generic on purpose).
        const extra: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(body)) {
          if (!RESERVED_KEYS.has(key) && key !== 'details') {
            extra[key] = value;
          }
        }
        return { status, code, message, details, extra };
      }
      return { status, code: ErrorContractFilter.codeForStatus(status), message: exception.message, extra: {} };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      extra: {},
    };
  }

  private static codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHENTICATED';
      case HttpStatus.FORBIDDEN:
        return 'PERMISSION_DENIED';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
