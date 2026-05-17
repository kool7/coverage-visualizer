# Plan: Auto-Run Coverage on Test File Save

Spec: `docs/spec-auto-run-on-test-change.md`

## Dependency Order

```
Task 1 (config)
    ↓
Task 2 (status bar spinner)
    ↓
Task 3 (test file watcher + debounced run)
    ↓
Task 4 (manual test + compile check)
    ↓
Task 5 (ship gate)
    ↓
Task 6 (PR + release)
```

---

## Tasks

- [ ] **Task 1 — Add config setting**
  - Add `coverageVisualizer.autoRunOnTestChange` boolean (default `true`) to `package.json`
    `contributes.configuration.properties`
  - Add `autoRunOnTestChange: boolean` to `getConfig()` return value in `src/config.ts`
  - Acceptance: `getConfig().autoRunOnTestChange` returns `true` by default, `false` when set
  - Verify: `npm run compile` passes; read config value in extension console
  - Files: `package.json`, `src/config.ts`

- [ ] **Task 2 — Add spinner to status bar**
  - Extend `updateStatusBar` in `src/ui/statusBar.ts` to accept an optional `running: boolean`
    flag; when `true`, prepend `$(sync~spin)` to the status bar text
  - Acceptance: status bar shows spinner icon while pytest is in progress, normal % when done
  - Verify: `npm run compile` passes; manually trigger via F5 and confirm visual
  - Files: `src/ui/statusBar.ts`, `src/extension.ts` (call site)

- [ ] **Task 3 — Test file watcher + debounced auto-run**
  - Inside `setupWatchers()` in `src/extension.ts`, add a `FileSystemWatcher` for the glob
    `{test_*.py,*_test.py,tests/**/*.py,test/**/*.py}`
  - On `onDidChange` / `onDidCreate`: if `autoRunOnTestChange` is false, return early;
    otherwise debounce 2s then call the existing `handleNoCoverage` / `loadAndApply` flow
  - Show spinner (Task 2) while running; clear it on completion
  - Acceptance: save a test file → 2s delay → pytest runs → dashboard updates
  - Verify: F5 host, save a test file, observe status bar spinner and dashboard refresh
  - Files: `src/extension.ts`

- [ ] **Task 4 — Compile + manual acceptance check**
  - Run `npm run compile` — zero errors
  - Run `npm test` — all existing tests pass
  - Open F5 host, write a new test, save → confirm spinner → confirm dashboard % changes
  - Confirm saving a non-test `.py` file does NOT trigger a run
  - Confirm multiple rapid saves = one run (debounce)

- [ ] **Task 5 — /ship quality gate**
  - Run `/ship` — parallel fan-out to code-reviewer + security-auditor + test-engineer
  - Resolve any Critical or Important findings before raising PR
  - Files: all modified files above

- [ ] **Task 6 — PR + release**
  - Create branch `feat/auto-run-on-test-change`
  - Run `/release patch` to bump `package.json` to next version on the branch
  - Run `/create-pr CV` — title format `[CV-N]: [Enhancement] Auto-Refresh Coverage on Test Save`
  - After merge: `git checkout main && git pull && git tag vX.Y.Z && git push origin vX.Y.Z`

---

## Risks

| Risk | Mitigation |
|------|-----------|
| User has large test suite — 30s run per save | `autoRunOnTestChange` setting defaults true; spinner makes wait visible |
| `handleNoCoverage` prompts user instead of silently running | Separate the "run pytest silently" path from the "ask user" prompt path |
| Watcher glob too broad — catches conftest.py, fixtures | `isTestFile()` already handles this; apply same filter before triggering |
| Windows glob separator issues | Use `RelativePattern` — VS Code handles separators internally |
