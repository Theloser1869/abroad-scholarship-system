# PHASE CHECKPOINT

Replace `<PHASE>` with current phase.

Before calling the phase complete:

## 1. Requirements
- [ ] SRS reread
- [ ] scope understood
- [ ] no silent assumption

## 2. Implementation
- [ ] DB
- [ ] API
- [ ] UI
- [ ] permissions
- [ ] audit
- [ ] validation

## 3. Quality
- [ ] migration passes
- [ ] seed passes
- [ ] unit tests pass
- [ ] integration tests pass
- [ ] e2e/security tests where applicable
- [ ] typecheck passes
- [ ] lint passes
- [ ] build passes

## 4. Security
- [ ] authorized path tested
- [ ] unauthorized path tested
- [ ] scope isolation tested
- [ ] sensitive fields tested
- [ ] download/export tested

## 5. Documentation
- [ ] phase status created
- [ ] schema/API docs updated
- [ ] assumptions recorded
- [ ] risks recorded

## 6. Git
Review:
- git diff
- git status

Do not move to next phase unless all mandatory checks PASS.

Report:
PASS / FAIL / BLOCKED
