import { describe, expect, it } from "vitest";
import { can, canAll, canAny } from "./use-permissions";

describe("can()", () => {
  it("SYSTEM_ADMIN can users:view but not students:view (RBAC_MATRIX.md — zero business-domain access by design)", () => {
    expect(can("SYSTEM_ADMIN", "users", "view")).toBe(true);
    expect(can("SYSTEM_ADMIN", "students", "view")).toBe(false);
    expect(can("SYSTEM_ADMIN", "documents", "view")).toBe(false);
  });

  it("only STUDENT_PARENT can portal:access", () => {
    expect(can("STUDENT_PARENT", "portal", "access")).toBe(true);
    for (const role of ["EXECUTIVE_DIRECTOR", "DEPARTMENT_MANAGER", "CONSULTANT", "DOCUMENT_SPECIALIST", "SALES_MARKETING", "ADMIN_FINANCE", "SYSTEM_ADMIN"] as const) {
      expect(can(role, "portal", "access")).toBe(false);
    }
  });

  it("CONSULTANT has zero contracts/payments grant (financial data does not follow from Case access)", () => {
    expect(can("CONSULTANT", "cases", "view")).toBe(true);
    expect(can("CONSULTANT", "contracts", "view")).toBe(false);
    expect(can("CONSULTANT", "payments", "view")).toBe(false);
  });

  it("ADMIN_FINANCE has zero students/cases grant despite full contracts/payments access", () => {
    expect(can("ADMIN_FINANCE", "contracts", "create")).toBe(true);
    expect(can("ADMIN_FINANCE", "payments", "record")).toBe(true);
    expect(can("ADMIN_FINANCE", "students", "view")).toBe(false);
    expect(can("ADMIN_FINANCE", "cases", "view")).toBe(false);
  });

  it("ADMIN_FINANCE and DEPARTMENT_MANAGER never get contracts:approve/amend below EXECUTIVE_DIRECTOR-level oversight roles' full set — ADMIN_FINANCE specifically excludes approve/amend", () => {
    expect(can("ADMIN_FINANCE", "contracts", "approve")).toBe(false);
    expect(can("ADMIN_FINANCE", "contracts", "amend")).toBe(false);
    expect(can("EXECUTIVE_DIRECTOR", "contracts", "approve")).toBe(true);
  });

  it("an unknown/null roleCode is always denied, never defaults to allow", () => {
    expect(can(null, "students", "view")).toBe(false);
    expect(can(undefined, "users", "view")).toBe(false);
  });

  it("DOCUMENT_SPECIALIST is view-only on counseling resources, unlike CONSULTANT's full access", () => {
    expect(can("DOCUMENT_SPECIALIST", "assessments", "view")).toBe(true);
    expect(can("DOCUMENT_SPECIALIST", "assessments", "create")).toBe(false);
    expect(can("CONSULTANT", "assessments", "create")).toBe(true);
  });
});

describe("canAny() / canAll()", () => {
  it("canAny is true if the role holds at least one of the listed actions", () => {
    expect(canAny("CONSULTANT", "documents", ["archive", "delete"])).toBe(true); // has archive, not delete
    expect(canAny("STUDENT_PARENT", "documents", ["edit", "share", "archive"])).toBe(false); // has none of these
  });

  it("canAll requires every listed action to be granted", () => {
    expect(canAll("EXECUTIVE_DIRECTOR", "documents", ["view", "create", "archive"])).toBe(true);
    expect(canAll("STUDENT_PARENT", "documents", ["view", "create", "archive"])).toBe(false); // no archive
  });
});
