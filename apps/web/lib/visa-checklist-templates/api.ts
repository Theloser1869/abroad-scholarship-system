import { apiFetch } from "../api/client";
import type { PaginatedResponse } from "../api/types";
import type { CreateVisaChecklistTemplateInput, UpdateVisaChecklistTemplateInput, VisaChecklistTemplate, VisaChecklistTemplateListParams } from "./types";

/// Typed calls against `VisaChecklistTemplatesController`.

export function listVisaChecklistTemplates(params: VisaChecklistTemplateListParams): Promise<PaginatedResponse<VisaChecklistTemplate>> {
  return apiFetch<PaginatedResponse<VisaChecklistTemplate>>("/visa-checklist-templates", { query: params });
}

export function getVisaChecklistTemplate(id: string): Promise<VisaChecklistTemplate> {
  return apiFetch<VisaChecklistTemplate>(`/visa-checklist-templates/${id}`);
}

/// `409 DUPLICATE_VISA_CHECKLIST_TEMPLATE { existingTemplateId }` on a repeated
/// (countryCode, visaType, title) — surfaced verbatim.
export function createVisaChecklistTemplate(input: CreateVisaChecklistTemplateInput): Promise<VisaChecklistTemplate> {
  return apiFetch<VisaChecklistTemplate>("/visa-checklist-templates", { method: "POST", body: input });
}

export function updateVisaChecklistTemplate(id: string, input: UpdateVisaChecklistTemplateInput): Promise<VisaChecklistTemplate> {
  return apiFetch<VisaChecklistTemplate>(`/visa-checklist-templates/${id}`, { method: "PATCH", body: input });
}
