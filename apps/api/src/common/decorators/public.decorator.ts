import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/// Marks a route as not requiring authentication. Absence of this decorator is the
/// deny-by-default case enforced by `AuthGuard` (NFR-SEC-01).
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
