import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import type { PartnerStudentLink } from "@/lib/partner-student-links/types";
import { PartnerStudentLinkRow } from "./partner-student-link-row";

const partnerStudentLinksApi = vi.hoisted(() => ({ archivePartnerStudentLink: vi.fn() }));
vi.mock("@/lib/partner-student-links/api", () => partnerStudentLinksApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeLink(overrides: Partial<PartnerStudentLink> = {}): PartnerStudentLink {
  return {
    id: "psl-1",
    partnerId: "partner-1",
    partner: { id: "partner-1", name: "Global Education Agency", countryCode: "VN" },
    studentId: "student-1",
    student: { id: "student-1", studentCode: "STU-2026-00001", fullName: "Tran Thi B" },
    caseId: null,
    applicationId: null,
    linkType: "Referral",
    status: "ACTIVE",
    effectiveDate: null,
    endDate: null,
    notes: null,
    createdById: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("PartnerStudentLinkRow — a pure junction row (SRS 6.17); no hard delete (Hard Rule #5), archive stamps endDate, preserving history", () => {
  it("renders the linked student and link type", () => {
    renderWithProviders(
      <ul>
        <PartnerStudentLinkRow link={makeLink()} canEdit={true} />
      </ul>,
    );
    expect(screen.getByText("Tran Thi B")).toBeInTheDocument();
    expect(screen.getByText("Referral")).toBeInTheDocument();
  });

  it("archives an ACTIVE link after confirmation via the shared ConfirmDialog (F09 — no more window.confirm; no hard delete)", async () => {
    partnerStudentLinksApi.archivePartnerStudentLink.mockResolvedValue(makeLink({ status: "ARCHIVED" }));

    renderWithProviders(
      <ul>
        <PartnerStudentLinkRow link={makeLink({ status: "ACTIVE" })} canEdit={true} />
      </ul>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Lưu trữ" }));
    expect(partnerStudentLinksApi.archivePartnerStudentLink).not.toHaveBeenCalled();
    // Trigger button + the dialog's own confirm button share the label — the dialog's is second.
    await userEvent.click(screen.getAllByRole("button", { name: "Lưu trữ" })[1]);

    await waitFor(() => expect(partnerStudentLinksApi.archivePartnerStudentLink).toHaveBeenCalledWith("psl-1"));
  });

  it("hides the archive action once already ARCHIVED (terminal) and for a read-only viewer", () => {
    renderWithProviders(
      <ul>
        <PartnerStudentLinkRow link={makeLink({ status: "ARCHIVED" })} canEdit={true} />
      </ul>,
    );
    expect(screen.queryByRole("button", { name: "Lưu trữ" })).not.toBeInTheDocument();
  });

  it("hides the archive action for a read-only viewer even on an ACTIVE link", () => {
    renderWithProviders(
      <ul>
        <PartnerStudentLinkRow link={makeLink({ status: "ACTIVE" })} canEdit={false} />
      </ul>,
    );
    expect(screen.queryByRole("button", { name: "Lưu trữ" })).not.toBeInTheDocument();
  });
});
