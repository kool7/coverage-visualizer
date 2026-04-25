# Python Coverage Visualizer

> See which lines your tests actually hit — inline, in the editor, the moment you run them.

[![CI](https://github.com/kool7/coverage-visualizer/actions/workflows/ci.yml/badge.svg)](https://github.com/kool7/coverage-visualizer/actions/workflows/ci.yml)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.90+-blue?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=kool7.coverage-visualizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

You run your tests. You get a percentage. But which lines actually ran? Coverage Visualizer highlights them inline — green for covered, red for missed — right where you write code. No browser. No switching tabs. No mental mapping from a report file back to your editor.

![Coverage Visualizer in action](assets/demo.gif)

---

## Features

**Inline highlights** — green and red line backgrounds appear across every open Python file the moment you load coverage. Overview ruler markers let you scan the whole file at a glance.

**CodeLens** — a live coverage percentage floats above every `def` and `class` as you work, so you never have to wonder what a function's coverage is.

**Hover tooltips** — hover any highlighted line to see a clear ✓ Covered or ✗ Not covered message.

**Interactive dashboard** — an SVG ring chart, overall stats, and a sortable file table. Click any file to jump straight to it.

**Sidebar tree view** — a persistent Coverage panel in the Explorer sidebar shows pass / warn / fail icons per file. Always visible, always current.

**Status bar** — your total coverage percentage lives in the status bar. Click it to open the dashboard.

**Auto-reload** — file watchers detect changes to your coverage file and refresh all decorations instantly. Run your tests, save, done.

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

Or install from a VSIX file:

```bash
code --install-extension coverage-visualizer-x.x.x.vsix
```

---

## Quick Start

```bash
# 1. Install pytest-cov in your Python project
pip install pytest-cov

# 2. Run your tests to generate coverage
pytest --cov=. --cov-report=json
```

Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run **Coverage Visualizer: Show Coverage**.

Green and red highlights appear on all open Python files immediately.

---

## Commands

| Command                               | What it does                                      |
| ------------------------------------- | ------------------------------------------------- |
| `Coverage Visualizer: Show Coverage`  | Load coverage and apply highlights to open files  |
| `Coverage Visualizer: Show Dashboard` | Open the interactive coverage dashboard           |
| `Coverage Visualizer: Clear Coverage` | Remove all highlights and reset state             |

---

## Configuration

Open **Settings** (`Cmd+,`) and search for **Coverage Visualizer**, or edit `settings.json` directly:

| Setting                                      | Default                   | Description                                            |
| -------------------------------------------- | ------------------------- | ------------------------------------------------------ |
| `coverageVisualizer.thresholdGood`           | `80`                      | % at or above which a file shows green in the sidebar  |
| `coverageVisualizer.thresholdWarn`           | `50`                      | % at or above which a file shows yellow (below → red)  |
| `coverageVisualizer.coveredHighlightColor`   | `rgba(0, 180, 0, 0.10)`   | Background color for covered lines                     |
| `coverageVisualizer.uncoveredHighlightColor` | `rgba(220, 50, 50, 0.10)` | Background color for uncovered lines                   |
| `coverageVisualizer.enableCodeLens`          | `true`                    | Show coverage % above `def` / `class` definitions      |
| `coverageVisualizer.enableHoverMessages`     | `true`                    | Show covered / not-covered tooltip on hover            |
| `coverageVisualizer.autoReloadOnChange`      | `true`                    | Auto-reload decorations when coverage files change     |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, architecture, test commands, and PR guidelines.

---

## License

MIT — see [LICENSE](LICENSE)
