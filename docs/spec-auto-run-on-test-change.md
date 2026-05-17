# Spec: Auto-Run Coverage on Test File Save

## Objective

When a developer writes or modifies a test file, the coverage dashboard and status bar should
automatically update with fresh numbers — without the user having to manually run pytest or
trigger any command.

**User:** Python developer using VS Code with coverage-visualizer installed. They are actively
writing tests and want immediate feedback on whether their new test improves coverage.

**Problem today:** User saves `test_calculator.py` → nothing happens → they manually run pytest
→ coverage files update → dashboard refreshes. The gap between save and updated numbers is
entirely manual friction.

**Success criteria:**
- User saves any test file → pytest runs in the background within 2s → dashboard shows updated %
- Status bar shows a spinner while pytest is running so the user knows something is happening
- If pytest fails, a warning notification appears (reusing existing behaviour from `handleNoCoverage`)
- A setting `coverageVisualizer.autoRunOnTestChange` (boolean, default `true`) lets users with
  slow test suites opt out
- Behaviour is additive — existing manual `coverage-visualizer.show` command is unchanged

## Tech Stack

TypeScript, VS Code Extension API 1.90+, Node.js `child_process.spawn`

## Commands

```bash
npm run compile       # compile TypeScript → out/
npm test              # run Jest unit tests
npm run lint          # ESLint on src/
```

## Project Structure

```
src/
  extension.ts          ← file watcher setup lives here (setupWatchers)
  config.ts             ← add autoRunOnTestChange setting here
  ui/
    statusBar.ts        ← add spinner state here
package.json            ← add new configuration property
```

## Code Style

Follow existing patterns exactly. New watchers go inside `setupWatchers()`. New config keys go
in `getConfig()`. No new files unless unavoidable.

```typescript
// Good — matches existing watcher pattern
const testWatcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(root, '{test_*.py,*_test.py,tests/**/*.py,test/**/*.py}')
);
testWatcher.onDidChange(debouncedTestRun);
testWatcher.onDidCreate(debouncedTestRun);
context.subscriptions.push(testWatcher);
```

## Testing Strategy

- Unit tests in `tests/` using Jest (existing framework)
- `vscode` is mocked at `tests/__mocks__/vscode.ts`
- New logic to test: debounce behaviour, setting read, watcher glob pattern
- `extension.ts` integration tested manually via F5

## Boundaries

- **Always:** run `npm run compile` before committing, keep changes inside existing functions
- **Ask first:** adding new npm dependencies, changing existing watcher patterns
- **Never:** auto-run on non-test source file changes, run pytest without checking
  `autoRunOnTestChange` setting first, break the existing manual `show` command

## Assumptions

1. Test files are identified by filename pattern only (`test_*.py`, `*_test.py`) or by living
   inside `tests/` or `test/` directories — same logic already used in `isTestFile()`
2. Debounce is 2 seconds after the last save event (not per-save)
3. Auto-run reuses the existing `handleNoCoverage` spawn infrastructure — no new process manager
4. The spinner uses VS Code's existing `$(sync~spin)` ThemeIcon in the status bar
5. We do NOT run only the changed test file — full suite always, for accurate numbers

## Not Doing (and Why)

- **Run only the changed test file** — gives partial/misleading coverage numbers; requires
  coverage merging complexity; not worth it for v1
- **pytest-watch / `--watch` mode** — external dependency we don't control; overkill
- **Per-test CodeLens "▶ Run"** — different feature, much larger scope, separate PR
- **Watch non-test source files** — source changes don't add tests; false positives everywhere
- **Auto-install pytest-cov if missing** — out of scope; existing `handleNoCoverage` already
  handles missing dependencies

## Open Questions

None — direction confirmed in brainstorm session.

## Success Criteria (testable)

- [ ] Save `test_foo.py` → within 2s pytest runs → status bar shows spinner → dashboard % updates
- [ ] Set `autoRunOnTestChange: false` → save test file → nothing happens
- [ ] pytest exits non-zero → warning notification shown → coverage not cleared
- [ ] Saving a non-test `.py` file → no auto-run triggered
- [ ] Multiple rapid saves → only one pytest run (debounce working)
