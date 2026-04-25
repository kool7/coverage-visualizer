# Python Coverage Visualizer

> Know which lines your tests missed — without leaving the editor.

You run `pytest`. You get 73%. But 27% of what? Finding uncovered lines means opening a browser report, hunting for your file, and mentally mapping line numbers back to your code. Coverage Visualizer cuts all of that — green and red highlights appear inline, right where you write, the moment you run your tests.

![Coverage Visualizer in action](assets/demo.gif)

---

## Features

**Inline highlights** — green line backgrounds for covered lines, red for missed, with overview ruler markers so you can scan an entire file at a glance without scrolling.

<!-- demo GIF: record opening a Python file after Show Coverage, showing green/red line backgrounds appearing -->

**CodeLens** — a live coverage percentage appears above every `def` and `class` as you work. See a function's coverage without opening any report.

<!-- demo GIF: record CodeLens percentages above def/class lines -->

**Hover tooltips** — hover any highlighted line for an instant ✓ Covered or ✗ Not covered message.

**Interactive dashboard** — an SVG ring chart, overall stats, and a sortable file table. Click any filename to jump straight to it in the editor.

<!-- demo GIF: record opening dashboard and clicking a file row -->

**Sidebar tree view** — a persistent Coverage panel in the Explorer sidebar shows every file with a pass / warn / fail icon. Always visible, always current.

**Status bar** — your total coverage percentage sits in the status bar. Click it to open the dashboard.

**Auto-reload** — file watchers detect changes to your coverage file and refresh all decorations instantly. Run your tests, save — done.

---

## Supported Formats

| Format          | How to generate                             |
| --------------- | ------------------------------------------- |
| `coverage.json` | `pytest --cov=. --cov-report=json`          |
| `coverage.xml`  | `pytest --cov=. --cov-report=xml`           |
| `.coverage`     | `pytest --cov=.` (raw SQLite, no JSON step) |

No Python runtime required — the extension reads all three formats natively.

---

## Installation

Search for **Python Coverage Visualizer** in the Extensions panel (`Cmd+Shift+X` / `Ctrl+Shift+X`) and click Install.

---

## Quick Start

1. Install pytest-cov in your Python project:
   ```bash
   pip install pytest-cov
   ```

2. Run your tests and generate coverage:
   ```bash
   pytest --cov=. --cov-report=json
   ```

3. In VS Code, open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run:
   **Coverage Visualizer: Show Coverage**

Green and red highlights appear across all open Python files immediately.

---

## Commands

| Command                               | What it does                                     |
| ------------------------------------- | ------------------------------------------------ |
| `Coverage Visualizer: Show Coverage`  | Load coverage and apply highlights to open files |
| `Coverage Visualizer: Show Dashboard` | Open the interactive coverage dashboard          |
| `Coverage Visualizer: Clear Coverage` | Remove all highlights and reset state            |

---

## Configuration

Open **Settings** (`Cmd+,`) and search for **Coverage Visualizer**, or add to `settings.json`:

| Setting                                      | Default                   | Description                                            |
| -------------------------------------------- | ------------------------- | ------------------------------------------------------ |
| `coverageVisualizer.thresholdGood`           | `80`                      | % at or above which a file shows green in the sidebar  |
| `coverageVisualizer.thresholdWarn`           | `50`                      | % at or above which a file shows yellow (below → red)  |
| `coverageVisualizer.coveredHighlightColor`   | `rgba(0, 180, 0, 0.10)`   | Background color for covered lines                     |
| `coverageVisualizer.uncoveredHighlightColor` | `rgba(220, 50, 50, 0.10)` | Background color for uncovered lines                   |
| `coverageVisualizer.enableCodeLens`          | `true`                    | Show coverage % above `def` / `class` definitions      |
| `coverageVisualizer.enableHoverMessages`     | `true`                    | Show covered / not-covered tooltip on hover            |
| `coverageVisualizer.autoReloadOnChange`      | `true`                    | Auto-reload decorations when coverage files change     |
| `coverageVisualizer.coverageJsonPath`        | `coverage.json`           | Path to coverage.json relative to workspace root       |
