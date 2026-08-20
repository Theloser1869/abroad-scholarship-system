import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

declare module 'express' {
  interface Request {
    requestId: string;
  }
}

/// Every request gets a request ID — reused from the caller's `X-Request-Id` header if
/// present (so a client-generated ID survives the whole call chain), otherwise generated
/// here. Echoed back on the response and attached to every audit log row and error body,
/// per 02_API_FOUNDATION.md "request ID".
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(REQUEST_ID_HEADER);
    const requestId = incoming && incoming.trim().length > 0 ? incoming : randomUUID();
    req.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}
