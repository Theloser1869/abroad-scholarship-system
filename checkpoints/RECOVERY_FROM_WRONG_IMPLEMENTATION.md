# RECOVERY – CLAUDE CODE IMPLEMENTED THE WRONG WAY

STOP NEW FEATURE DEVELOPMENT.

1. Re-read SRS.
2. Identify violated requirement.
3. Identify architectural root cause.
4. Identify affected entities.
5. Identify affected migrations.
6. Identify affected APIs.
7. Identify affected UI.
8. Identify affected permissions.
9. Identify affected tests.
10. Design smallest safe correction.
11. Implement migration/data repair if required.
12. Run regression tests.
13. Verify no duplicate entity was introduced.
14. Update docs/DECISIONS.md and phase status.

Do not hide the original mistake.
Do not rewrite unrelated modules.
Report:
- root cause
- correction
- data impact
- regression risk
- tests
