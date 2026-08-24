/// Mirrors `AcceptParentInvitationDto`/`PortalAccessService.acceptInvitation`
/// (`apps/api/src/modules/portal/portal-access/**`). `username`/`password` are required ONLY
/// when the invited email does not already belong to an existing STUDENT_PARENT account (a
/// parent linking a second child reuses their existing login instead) — the DTO layer can't
/// express that conditional requirement (it depends on a DB lookup), so both stay optional
/// here too; the backend decides and returns `409 CREDENTIALS_REQUIRED` if they were needed
/// but missing.
export interface AcceptParentInvitationInput {
  username?: string;
  password?: string;
}

export interface AcceptParentInvitationResult {
  studentContactId: string;
}
