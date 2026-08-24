import Link from "next/link";
import { ApiError } from "@/lib/api/types";
import { crmErrorMessage } from "@/lib/api/error-messages";

/// Renders a form's caught error as plain text, plus — only when the backend's 409 body
/// carries an `existing*Id` field (University/Program/ScholarshipMaster/UniversityChoice/
/// Application duplicate-detection responses) — a link to the real conflicting record.
/// Duplicate detection is entirely backend-decided (F05 instruction §8: "Duplicate
/// detection phải do backend quyết định, không duplicate detection bằng frontend string
/// matching"); this component never guesses a duplicate itself, it only surfaces the
/// server's own verdict. The backend returns a single existing-record ID, never a
/// candidates array (confirmed directly against every `assertNoDuplicate` implementation),
/// so this is a link, not a multi-candidate picker.
export function DuplicateConflictNotice({
  error,
  existingIdField,
  hrefBuilder,
  linkLabel,
}: {
  error: unknown;
  existingIdField: string;
  /** Omit when the conflicting entity has no standalone detail route (e.g. UniversityChoice
   * — list-only per F01's route map, same "no invented route" precedent as F04's Payment). */
  hrefBuilder?: (id: string) => string;
  linkLabel?: string;
}) {
  const message = error instanceof ApiError ? crmErrorMessage(error) : error instanceof Error ? error.message : crmErrorMessage(error);
  const existingId = error instanceof ApiError && typeof error.raw[existingIdField] === "string" ? (error.raw[existingIdField] as string) : undefined;

  return (
    <div role="alert" className="space-y-1 text-sm text-danger">
      <p>{message}</p>
      {existingId && hrefBuilder ? (
        <Link href={hrefBuilder(existingId)} className="text-primary underline-offset-2 hover:underline">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
