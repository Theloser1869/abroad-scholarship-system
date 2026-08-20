import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { Principal } from '../context/principal';

/// Injects the resolved `Principal` (or `null` for a public/anonymous route) into a
/// controller method parameter.
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): Principal | null => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return req.principal;
});
