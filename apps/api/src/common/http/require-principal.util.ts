import { UnauthorizedException } from '@nestjs/common';
import { Principal } from '../context/principal';

/// Shared by every Phase 07 controller (`@CurrentUser()` is nullable at the type level;
/// `AuthGuard` already guarantees a principal exists for any non-`@Public()` route, so this
/// narrows the type rather than adding a new runtime possibility). Earlier phases each
/// inline their own copy of this same three-line function — not worth a retrofit (no
/// technical reason to touch already-PASSed files), but new Phase 07 files share this one
/// instead of repeating it eight more times.
export function requirePrincipal(principal: Principal | null): Principal {
  if (!principal) {
    throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
  }
  return principal;
}
