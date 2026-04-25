# Coverage Visualizer

> Inline Python test coverage — green/red highlights, CodeLens, dashboard, and sidebar tree, all inside VS Code

[![CI](https://github.com/kool7/coverage-visualizer/actions/workflows/ci.yml/badge.svg)](https://github.com/kool7/coverage-visualizer/actions/workflows/ci.yml)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.90+-blue?logo=visualstudiocode)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Coverage Visualizer reads your Python coverage data and shows it directly in the editor — no browser, no external report viewer. Run your tests once, open a file, and see exactly which lines were hit. Supports `coverage.json`, `coverage.xml`, and the raw `.coverage` SQLite database with no Python runtime dependency.

<!-- Add a demo GIF here once the extension is published -->
<!-- ![Coverage Visualizer Demo](assets/demo.gif) -->

---

## Features

- **Inline highlights** — green/red line backgrounds on covered and uncovered lines, with overview ruler markers
- **CodeLens** — coverage % above every `def` and `class` as you write
- **Hover tooltips** — hover any highlighted line for a ✓ Covered or ✗ Not covered message
- **Interactive dashboard** — SVG ring chart, summary stats, sortable/filterable file table, click to jump to any file
- **Sidebar tree view** — always-visible Coverage panel in the Explorer with pass/warn/fail icons per file
- **Status bar** — persistent coverage % at the bottom; click to open the dashboard
- **Auto-reload** — file watchers detect changes to any coverage file and reload instantly

---

## Quick Start

```bash
# 1. Install pytest-cov in your Python project
pip install pytest-cov

# 2. Run your tests and generate coverage
pytest --cov=. --cov-report=json

# 3. In VS Code, open the Command Palette (Cmd+Shift+P / Ctrl+Shift+P) and run:
#    Coverage Visualizer: Show Coverage
```

Highlights appear on all open Python files immediately.

---

## Installation

**From the VS Code Marketplace** *(coming soon)*

Search for `Coverage Visualizer` in the Extensions panel (`Cmd+Shift+X`).

**From a VSIX**

```bash
code --install-extension coverage-visualizer-x.x.x.vsix
```

**From source**

```bash
git clone https://github.com/kool7/coverage-visualizer.git
cd coverage-visualizer
npm install
npm run compile
```

Press **F5** in VS Code to open the Extension Development Host with the extension active.

---

## Usage

### Commands

Open the Command Palette and type `Coverage Visualizer`:

| Command | Description |
|---|---|
| `Coverage Visualizer: Show Coverage` | Load coverage and apply highlights to all open editors |
| `Coverage Visualizer: Show Dashboard` | Open the interactive coverage dashboard panel |
| `Coverage Visualizer: Clear Coverage` | Remove all highlights and reset state |

### Coverage File Formats

The extension auto-detects whichever format is present in your workspace root, checked in this order:

| Format | How to generate |
|---|---|
| `coverage.json` | `pytest --cov=. --cov-report=json` |
| `coverage.xml` | `pytest --cov=. --cov-report=xml` |
| `.coverage` | `pytest --cov=.` |

The `.coverage` SQLite file is read by a bundled pure-JavaScript SQLite engine — no Python runtime calls are made by the extension.

---

## Configuration

Open **Settings** (`Cmd+,`) and search for **Coverage Visualizer**, or edit `settings.json` directly:

| Setting | Default | Description |
|---|---|---|
| `coverageVisualizer.thresholdGood` | `80` | % at or above which a file shows green |
| `coverageVisualizer.thresholdWarn` | `50` | % at or above which a file shows yellow (below → red) |
| `coverageVisualizer.coveredHighlightColor` | `rgba(0, 180, 0, 0.10)` | Background color for covered lines |
| `coverageVisualizer.uncoveredHighlightColor` | `rgba(220, 50, 50, 0.10)` | Background color for uncovered lines |
| `coverageVisualizer.enableCodeLens` | `true` | Show coverage % above `def` / `class` definitions |
| `coverageVisualizer.enableHoverMessages` | `true` | Show covered/not-covered tooltip on hover |
| `coverageVisualizer.autoReloadOnChange` | `true` | Auto-reload when coverage files change on disk |

---

## How It Works

```
pytest --cov=. --cov-report=json
         │
         ▼
   coverage.json  ──┐
   coverage.xml   ──┤──▶  CoverageReport  ──▶  Inline highlights (green/red)
   .coverage      ──┘        (unified)    ──▶  CodeLens + Hover tooltips
                                          ──▶  Status bar + Dashboard
                                          ──▶  Sidebar tree view
```

1. A file watcher detects when any coverage file changes (or you run **Show Coverage**)
2. The parser reads whichever format is present and builds a unified `CoverageReport`
3. All UI components update from that single in-memory report
4. Switching to a different file reapplies decorations instantly — no disk read

---

## Project Structure

```
src/
├── extension.ts            # Activation, commands, decorations, file watchers
├── config.ts               # Typed wrapper for all extension settings
├── parsers/
│   └── coverageParser.ts   # JSON, XML, and SQLite parsers + shared utilities
├── providers/
│   ├── codeLensProvider.ts # Coverage % above def/class
│   ├── hoverProvider.ts    # Hover tooltip on highlighted lines
│   └── treeProvider.ts     # Explorer sidebar tree view
└── ui/
    ├── dashboardPanel.ts   # WebView dashboard (ring chart, file table)
    └── statusBar.ts        # Status bar item

tests/
├── coverageParser.test.ts  # Jest tests covering all three formats
├── fixtures/               # coverage.json, coverage.xml, .coverage test data
└── __mocks__/vscode.ts     # VS Code API mock for Jest
```

---

## Development

### Setup

```bash
git clone https://github.com/kool7/coverage-visualizer.git
cd coverage-visualizer
npm install
```

### Running Tests

```bash
npm run compile        # TypeScript → out/
npm test               # Run all Jest tests
npm run test:watch     # Watch mode
npm run test:coverage  # Generate coverage report
npm run lint           # ESLint
```

Run a single test by name:

```bash
npx jest --testNamePattern "parseCoverageSqlite"
```

### Regenerating Test Fixtures

The `.coverage` SQLite fixture is generated from `demo-python-project/` (no Python required):

```bash
node scripts/generate-test-coverage-db.mjs
cp demo-python-project/.coverage tests/fixtures/.coverage
```

---

## Contributing

Contributions are welcome — please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

- Use a feature branch (`feat/`, `fix/`, `chore/`) — no direct commits to `main`
- All existing tests must pass: `npm test`
- TypeScript must compile cleanly: `npm run compile`
- Add tests for any new parser logic or bug fixes

---

## License

[MIT](LICENSE) © 2026 Kuldeep Singh Chouhan
