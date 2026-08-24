/// Mirrors `database/schema.prisma` `VisaChecklistTemplate` — GLOBAL master/configuration
/// data (F06 instruction §17-shaped, same `visa_checklist_templates` permission-gated-only
/// treatment as `admission_master`). Matching active templates are instantiated into real
/// `VisaChecklistItem` rows when a Visa is created — this catalog itself is never directly
/// attached to a Visa. **No `verify` action exists** for this entity (a real difference from
/// University/Program/ScholarshipMaster) — confirmed against the live controller.

export interface VisaChecklistTemplate {
  id: string;
  countryCode: string;
  visaType: string;
  title: string;
  required: boolean;
  sortOrder: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VisaChecklistTemplateListParams {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  countryCode?: string;
  visaType?: string;
  active?: boolean;
  [key: string]: string | number | boolean | undefined | null;
}

/// Mirrors `CreateVisaChecklistTemplateDto` exactly.
export interface CreateVisaChecklistTemplateInput {
  countryCode: string;
  visaType: string;
  title: string;
  required?: boolean;
  sortOrder?: number;
  active?: boolean;
}

export type UpdateVisaChecklistTemplateInput = Partial<CreateVisaChecklistTemplateInput>;

/// `409 DUPLICATE_VISA_CHECKLIST_TEMPLATE` on `(countryCode, visaType, title)`.
export interface DuplicateVisaChecklistTemplateError {
  code: "DUPLICATE_VISA_CHECKLIST_TEMPLATE";
  message: string;
  existingTemplateId: string;
}
