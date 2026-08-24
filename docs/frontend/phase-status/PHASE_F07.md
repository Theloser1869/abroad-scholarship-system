# PHASE STATUS — F07 (Documents + Notifications + Reporting Frontend)

## PHASE F07 STATUS: PASS

## READY FOR F08: YES

## SUMMARY

Built the Documents/Notifications/Reporting frontend on top of F02–F06's foundation, API-first
against the real backend, reusing every prior primitive (API client, `apiUpload`/
`apiDownloadBlob` — both already built in F02 anticipating this phase, auth, RBAC, App Shell,
Query/cache, `Table`/`Dialog`/`Badge`/`Toast`/`Skeleton`/`Money`/`EvidenceDocumentLink`/
`UserPicker`-style patterns) unchanged. **F07 required zero backend changes** — the first
domain phase since F03 with no DEC entry, no service edit, no e2e spec touch; every real
limitation found was a pre-existing backend-shape gap (documented as ASM-71 through ASM-78),
not something fixable within F07's "no unrelated backend work" scope. 5 new routes:
`/documents`, `/documents/upload`, `/documents/[id]`, `/notifications`, `/reports` — plus
`/dashboard` fleshed out from its F01 placeholder into real role-routed content (same path, not
counted as new). 47 routes total.

## DOCUMENT MANAGEMENT

`DocumentsController` has no `GET /documents` list route at all — not even an owner-entity-
scoped one (confirmed by reading the controller directly: seven routes exist, none of them a
bare list). So `/documents` is deliberately a small hub (lookup-by-id form + upload entry
point), never a browser, per the mega-prompt's own explicit gate: "Không tạo global document
browser nếu backend không có global list route." `/documents/[id]` is the only way to view a
document's full metadata — always reached either by a known id (an owning record's evidence
link, now enhanced with a "Chi tiết" link via `EvidenceDocumentLink`) or manual id entry. See
ASM-71.

## UPLOAD

`/documents/upload` mirrors `UploadDocumentDto` exactly (`ownerEntity` free-text with a
suggestion `<datalist>`, `ownerId` manual UUID, `documentType` free-text, `title`, plus the
file). Uses `apiUpload` (F02's multipart primitive) against `POST /documents`. Client-side
MIME/extension/size validation (`lib/documents/file-validation.ts`) mirrors the backend's real
`ALLOWED_MIME_TYPES`/`DEFAULT_MAX_DOCUMENT_SIZE_BYTES` allowlist for UX only — the backend
re-validates authoritatively (MIME + extension + magic bytes + size) regardless. A non-blocking
`duplicateOfId` on the response surfaces as an informational toast, never blocking the upload
(matches the backend's own comment: duplicate detection is informational only).

## SCAN STATUS

`DocumentScanStatus` (`PENDING`/`CLEAN`/`INFECTED`/`ERROR`) is rendered via its own dedicated
badge, independent from `DocumentStatus`. The detail page shows a warning banner while PENDING
("đang được quét virus — chưa thể tải xuống") and a danger banner for INFECTED/ERROR, and
disables/hides the download action in both cases — download is only ever offered when
`scanStatus === 'CLEAN'`, matching the backend's own unconditional block
(`DocumentsService.requestDownload`/`downloadByToken`, enforced for every role including
GLOBAL-scope ones).

## DOWNLOAD

Fully delegated to F04's existing `EvidenceDocumentLink` 2-step signed-URL flow — never
re-implemented. `requestDownload` (step 1, authorize+audit) returns a short-lived
`/documents/download/:token` path; the frontend resolves it via `resolveApiUrl` and opens it in
a new tab immediately, never storing the URL. No raw R2 URL, bucket name, or storage key is
ever rendered anywhere in the UI (`Document.fileReference` is deliberately excluded from every
type/display).

## SIGNED/OPAQUE URL

Unchanged from F04's flow — this phase added no new download mechanism, only more places that
trigger the existing one (the Document detail page) and more context around it (scan-status
gating, archived-state awareness).

## VERSIONING

`previousVersionId` is a real scalar the API returns; `nextVersion` is only a Prisma relation,
never selected — so version history can only walk *backward* from a known version, never
forward (ASM-73). The detail page renders a "Xem phiên bản trước" link when present. Creating a
new version (`DocumentVersionDialog`, `POST /documents/:id/versions`) always produces a
brand-new Document row chained via `previousVersionId` — never an in-place content swap — and
the caller is navigated straight to the new row's own detail page. Blocked once ARCHIVED (`409
DOCUMENT_ARCHIVED`, surfaced verbatim, never pre-checked client-side).

## ARCHIVE

A plain `window.confirm()` + `archiveDocument.mutateAsync()` (no payload, matching the
backend's `POST /:id/archive` taking no body) — same "no dialog needed for a no-payload
terminal-ish action" precedent F06 established for Enrollment withdraw. Hides Sửa/Tạo phiên
bản mới/Lưu trữ once ARCHIVED; Chia sẻ deliberately stays available (the backend's own `share`
action has no archived check — confirmed directly against `DocumentsService.share`, verified by
a dedicated test).

## DOCUMENT SECURITY

Access remains entirely grant-based (`DocumentAccess` rows, VIEW/DOWNLOAD/EDIT/SHARE) — the
same mechanism F04 already built on, unchanged this phase. `DocumentShareDialog` (`UserPicker` +
VIEW/DOWNLOAD checkboxes) is additive-only: the backend has no "list current grants" or
"revoke" endpoint (`ShareDocumentDto` only grants; confirmed by reading the controller/service —
no such routes exist), so the dialog cannot show who already has access, and there is no revoke
action anywhere (ASM-72). No field-level redaction exists for Document anywhere in
`FieldPolicyService` (confirmed by grep — zero matches) — access control is 100% grant-based, a
document is either fully visible (if the grant exists / GLOBAL-scope role) or 404
non-enumerating (never partial-field redaction). A 404 is used uniformly for "doesn't exist" vs.
"exists but not granted," rendered via the shared `QueryErrorState`'s exact required copy.

## NOTIFICATIONS

`/notifications` — self-service inbox, no permission gate (`NotificationsController` has no
`@RequirePermission`; `NotificationsService` enforces `recipientId === principal.userId`
unconditionally). All/Unread tabs and a channel filter (`IN_APP`/`EMAIL`/`SMS`/`ZALO`/
`WHATSAPP`) are backend-driven query params, never a client-side slice of a fully-fetched array.
Event → label/icon/navigation is a hand-transcribed map (`notification-event-map.ts`) built
directly from the eleven real `notify(BothChannels)(...)` call sites across six backend service
files — never invented type names (ASM-74). `nav-config.ts`'s `NavItem.resource`/`action` were
widened to optional specifically for the "Thông báo" item, the first nav item with genuinely no
backend permission gate.

## UNREAD COUNT

`useUnreadNotificationCount` (shared between `NotificationBell` and the inbox page) reads the
count off `meta.totalItems` via `unreadOnly=true, limit=1` — never a second full fetch just for
a badge, same technique F02's foundation already used. Marking read anywhere invalidates the
same `queryKeys.notifications.all` namespace, so the bell badge and the inbox list always agree.
`NotificationBell` now links to `/notifications` in the staff shell; in the Portal shell it
stays a non-interactive badge (Full Portal UX, including a Portal-scoped inbox, is explicit F08
scope — building a `/portal/notifications` route was out of bounds this phase).

## MARK READ

Per-row "Đánh dấu đã đọc" (`PATCH /notifications/:id/read`) and a page-level "Đánh dấu đã đọc
(trang này)" bulk action. No bulk endpoint exists on the backend at all — the bulk action loops
the single-item call over the currently-loaded unread rows only, explicitly labeled "(trang
này)" so it never implies reaching unread rows on other pages/filters (ASM-75). Clicking a
mapped, navigable notification marks it read as a side effect before navigating, never the
reverse order.

## REPORTING

`ReportsService` computes every number live from the real source-of-truth tables at query time
— no shadow/materialized table, no separate frontend calculation ever performed
(`components/crm/reports/status-count-table.tsx` renders backend `{status,count}[]` rows
as-is; revenue/receivables are `{currency,amount}[]` rendered per-currency via `Money`, never
summed across currencies, matching `ReportsService`'s own Phase-14-fix comment).

## EXECUTIVE

`/dashboard`'s Executive tab (`GET /reports/executive`) — activeCases/pipeline/revenue/
receivables/overduePaymentsCount/workload/deadlines/applications/scholarships/visas/
enrollments/closedOrArchivedCases, rendered via KPI cards + `StatusCountTable` (reusing each
domain's own existing `*_STATUS_LABEL` map — `CASE_STATUS_LABEL`/`APPLICATION_STATUS_LABEL`/
`SCHOLARSHIP_APPLICATION_STATUS_LABEL`/`VISA_STATUS_LABEL`/`ENROLLMENT_STATUS_LABEL` — never a
new label set invented for reports). Gated to EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER by role
check in the tab UI, matching `ReportsService.assertRole`'s identical two-role allowlist.

## MANAGER

`/dashboard`'s Manager tab (`GET /reports/manager`) — per-owner workload
(open/overdue/on-time-completion-rate/average-quality-score) + upcomingApplicationDeadlines.
Both EXECUTIVE_DIRECTOR and DEPARTMENT_MANAGER see BOTH the Executive and Manager tabs — there
is no ED-only vs. DM-only split on the backend (`assertRole` allows both roles on both
endpoints identically). `ownerId` renders raw (no `User` join exists server-side; not
reconstructed via a second frontend call — ASM-77).

## STAFF /reports/me

Every other role holding `reports:view` (CONSULTANT/DOCUMENT_SPECIALIST/SALES_MARKETING/
ADMIN_FINANCE) sees only `myOpenCases`/`myOpenTasks`/`myOverdueTasks` on the same `/dashboard`
route (role-routed, not a separate page) — `ReportsService.myDashboard` reuses the exact same
`ScopePolicyService.caseListFilter` every other list endpoint already applies.

## EXPORT

`/reports` — `reports:export`-gated (EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER only, matching
`ReportsService.exportCases`'s own `assertRole`), separate from the KPI dashboard (ASM-78).
Reason required (3-500 chars, `ExportReportQueryDto`), audited server-side (`@Audit('EXPORT')`).
Fully **synchronous** — `GET /reports/cases/export` returns `{ rows, rowCount }` directly, no
job/queue/status-polling infrastructure exists for it (ASM-76), so there is no progress bar to
build. The rendered table plus a "Tải xuống CSV" button format the SAME already-authorized,
already-scope-filtered, already-audited rows the backend just returned for this one request —
never a second unaudited data pull, never a client-side full-dataset dump.

## REPORT SECURITY

Every report endpoint requires `reports:view` (export additionally `reports:export`), enforced
server-side regardless of what the frontend gates. `ManagerDashboard`'s missing `User` join and
`ExecutiveDashboard`'s per-currency (never summed) money are both left exactly as the backend
returns them — no frontend reconstruction via a second endpoint call in either case.

## RBAC

Every action/nav item is gated by `usePermissions().can(resource, action)` against
`lib/permissions/rbac-data.ts` — never a role-name guess. `documents`/`reports` grants already
existed in `rbac-data.ts` from F02 and were verified directly against the live
`@RequirePermission` decorators on `DocumentsController`/`ReportsController` to match the
backend exactly — **no `rbac-data.ts` change was needed for either resource**. Notifications is
the one genuine exception: no backend permission resource exists for it at all, so `nav-config.ts`'s
`NavItem` type gained an optional `resource`/`action` (a `Sidebar` item with neither is now
visible to every authenticated role) specifically to represent this correctly, rather than
inventing a fake grant just to satisfy the existing required-field type.

## FIELD SECURITY

No field-level redaction exists for Document, Notification, or any Reports response anywhere in
`FieldPolicyService` (confirmed by grep — zero matches for any of the three). Document access
is grant-based (whole record or 404), Notification is recipient-scoped only, and Reports are
role-gated aggregates — none of the three needed or received field redaction handling this
phase.

## SCOPE / IDOR

Document: GLOBAL-scope roles bypass, everyone else needs an explicit `DocumentAccess` grant row
— a 404 (never 403) for a document that exists but isn't granted, same AC-02 non-enumeration
pattern as every other resource, rendered via the shared `QueryErrorState`. Notification:
`recipientId === principal.userId` enforced unconditionally inside the service — there is no
code path, client or server, that can read another user's notification; `markRead` on a
not-mine id also 404s (never 403), same non-enumeration pattern. Reports: every number is
computed through `ScopePolicyService.caseListFilter` (for `/reports/me`) or is a GLOBAL
aggregate gated by the leadership-only role check (`/reports/executive`/`/reports/manager`),
never client-widened.

## QUERY / CACHE

`lib/api/query-keys.ts` gained `documents` (detail-only — no list key, matching the backend's
own lack of a list route), `notifications` (`list`/`unreadCount`), and `reports`
(`executive`/`manager`/`me`) namespaces. Marking a notification read invalidates the entire
`notifications` namespace (list + unread count together — F07 instruction §33). Uploading/
editing/archiving/versioning a Document invalidates only its own `detail` key (there is no list
to invalidate). Report queries have no filter params to key on (each endpoint is parameterless
except `cases/export`'s `reason`, which is a mutation input, not a query key). No server state
is duplicated into `useState` anywhere in this phase's code.

## FINANCIAL PRECISION

Report revenue/receivables (`CurrencyAmount[]`) are rendered per-currency via the shared `Money`
component exactly as returned, never summed across currencies (matching
`ReportsService.sumByCurrency`'s own Phase-14-fix rationale, cited directly in its source
comment). No new Decimal-typed field was introduced this phase beyond what F04-F06 already
established the `string`-never-`number` convention for.

## TESTS

250/250 passing (57 files: 225 carried over from F06 unchanged + 25 new F07 tests across 6 new
test files plus 1 new test file for the existing `NotificationBell` component). Covers Document
detail (scan-status states, edit, archived-state action visibility, STUDENT_PARENT limited
actions), Document upload (forbidden state, success + duplicate note), Documents hub (forbidden,
lookup navigation), Notifications inbox (event mapping, unmapped-event fallback, mark-read +
navigate, tab/channel filters, bulk mark-read), Dashboard (forbidden, Executive/Manager tabs,
My-dashboard-only for non-leadership), Reports export (forbidden, reason gating, row rendering,
empty state), and NotificationBell (staff-shell link vs. Portal-shell badge). Full breakdown:
`FRONTEND_BUILD_STATUS.md`.

## TYPECHECK

PASS — `npm run web:typecheck`, 0 errors.

## LINT

PASS — `npm run web:lint`, 0 errors, 0 warnings.

## BUILD

PASS — `npm run web:build` (Turbopack); all 5 new F07 routes compile alongside every F01–F06
route (47 total), plus `/dashboard`'s real content replacing its F01 placeholder.

## BACKEND REGRESSION

PASS. **Zero backend files touched this phase** — `git status --short apps/api/ database/
docs/api/ docs/security/` shows exactly the same DEC-09/10/11/12 change set already
uncommitted from prior sessions, nothing new. Docker Desktop containers
(`abroad-scholarship-postgres`, `abroad-scholarship-minio`) were already running and healthy at
the start of this phase — no fresh start needed, unlike F06. `api:typecheck` PASS (0 errors),
`api:lint` PASS (0 errors, 7 pre-existing warnings, unchanged baseline). Given the backend is
genuinely untouched, unit and e2e were re-run to confirm the existing baseline remains intact
rather than assumed: unit **182/182 PASS** (unchanged from F06), full e2e **25 suites, 488/488
PASS** (unchanged from F06), run cleanly on the first attempt — no `kill EPERM`/zombie-process
saga this time (F06's Windows-specific instability did not recur). See
`FRONTEND_BUILD_STATUS.md`'s "Backend regression check — Phase F07" for full detail.

## FILES CREATED

`lib/documents/{hooks,file-validation}.ts` (extending the existing F04 `lib/documents/{api,
types}.ts` rather than replacing them), `lib/notifications/{hooks,notification-event-map}.ts`
(extending the existing F02 `lib/notifications/{notifications-api,types}.ts`),
`lib/reports/{types,api,hooks}.ts`,
`components/crm/documents/{document-edit-dialog,document-share-dialog,
document-version-dialog}.tsx`, `components/crm/reports/status-count-table.tsx`,
`app/(staff)/documents/page.tsx`, `app/(staff)/documents/upload/page.tsx`,
`app/(staff)/documents/[id]/page.tsx`, `app/(staff)/notifications/page.tsx`,
`app/(staff)/reports/page.tsx`, plus 6 new `*.test.tsx` files (one per new route) + 1 new test
file for the existing `NotificationBell` component, and this phase-status file.

## FILES UPDATED

`lib/documents/{api,types}.ts` (extended with the full upload/edit/share/archive/version
surface — F04's read-only `getDocument`/`requestDocumentDownload` untouched), `lib/notifications/
{notifications-api,types}.ts` (param type widened to the full `NotificationQueryDto` shape),
`lib/api/query-keys.ts` (added `documents`/`notifications`/`reports` namespaces),
`lib/api/error-messages.ts` (added F07 error codes; reused the existing generic
`PERMISSION_DENIED` entry for Reports rather than duplicating it),
`components/crm/status-badge.tsx` (added Document status/scan-status variant+label maps),
`components/crm/evidence-document-link.tsx` (added an optional "Chi tiết" link to
`/documents/[id]`, on by default), `components/shell/notification-bell.tsx` (now a real link in
the staff shell, portal-aware), `components/shell/{nav-config,sidebar}.tsx` (`NavItem.resource`/
`action` made optional for the no-permission-gate Notifications item; added Tài liệu/Thông báo/
Xuất báo cáo nav items), `app/(staff)/dashboard/page.tsx` (replaced the F01 placeholder with
real role-routed content), `docs/ASSUMPTIONS.md` (ASM-71 through ASM-78),
`docs/frontend/{FRONTEND_ROUTES,FRONTEND_API_MAP,FRONTEND_PERMISSION_MAP,
FRONTEND_BUILD_STATUS}.md`. **No `docs/DECISIONS.md` entry** — zero backend changes this phase.

## ASSUMPTIONS

- No `GET /documents` list route exists on the backend at all — the Documents hub is a lookup +
  upload entry point, never a browser (ASM-71).
- Document Share is additive-only — no list-grants or revoke endpoint exists (ASM-72).
- Document version history only walks backward via `previousVersionId`, never forward — there
  is no `nextVersionId` scalar (ASM-73).
- The notification event→navigation map is transcribed from real `notify(...)` call sites;
  TASK_* events get no link because no Task detail route exists anywhere in the frontend
  (ASM-74).
- "Mark all read" loops the single-item endpoint over the current page's unread rows only — no
  bulk endpoint exists (ASM-75).
- Reports export is fully synchronous — no job/status/async-download flow exists (ASM-76).
- Manager dashboard's per-owner workload rows show a raw `ownerId`, never a resolved name — no
  `User` join exists server-side (ASM-77).
- `/dashboard` (KPI views) and `/reports` (export) are two distinct pages, not one — different
  permission gates (`view` vs. `export`) and different UX needs (ASM-78).

## RISKS

- No live-backend browser smoke test was performed in this environment — same limitation
  carried over from F02–F06 (no reachable running `apps/api` instance here); all coverage is via
  mocked-API component/unit tests plus a clean production build and the backend regression
  check above.
- The repository's root `.env` still points at the production Supabase database (unchanged
  since F04) — a standing hazard for a future session that runs `npm run api:test:e2e`/`db:seed`
  without an explicit local-DB override.
- `apiUpload`'s real multipart wire behavior (boundary handling, large-file timing) was only
  exercised against mocked API calls this phase, same depth as every other domain phase's
  API-layer testing — never verified against a live backend upload.
- The Documents hub's "no list route" limitation means a staff user who doesn't already know a
  document's id and isn't looking at an owning record's evidence link has no way to discover it
  through this UI — a genuine, backend-shaped UX gap, not a frontend oversight (see ASM-71).

## KNOWN ISSUES

- `DocumentUploadForm`'s `ownerEntity`/`ownerId` fields remain free-text/manual-UUID — no
  generic cross-domain entity picker exists (same "manual linkage field" limitation as every
  F04-F06 evidence/linkage field).
- TASK_* notifications render with no clickable navigation — Task management has no standalone
  frontend route anywhere in this app through F07 (a pre-existing gap from F03, not introduced
  this phase).
- Full Student/Parent Portal (including a Portal-scoped notification inbox and document list)
  remains untouched by design — explicit F07 mega-prompt boundary, F08 scope.
- The Document subsystem's underlying storage/scan providers (local filesystem, EICAR-only
  heuristic scanner — ASM-50) are unchanged; F07 only built the UI on top of the existing,
  already-real upload/scan/download pipeline.

## READY FOR F08: YES
