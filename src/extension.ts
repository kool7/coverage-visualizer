import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  parseCoverageJson,
  parseCoverageXml,
  parseCoverageSqlite,
  findFileInReport,
  toLineRanges,
  CoverageReport,
  RawCoverageJson,
} from './parsers/coverageParser.js';
import { initStatusBar, updateStatusBar, clearStatusBar } from './ui/statusBar.js';
import { showDashboard, updateDashboard } from './ui/dashboardPanel.js';
import { getConfig } from './config.js';
import { CoverageCodeLensProvider } from './providers/codeLensProvider.js';
import { CoverageHoverProvider } from './providers/hoverProvider.js';
import { CoverageTreeProvider } from './providers/treeProvider.js';

let coveredDecoration: vscode.TextEditorDecorationType;
let uncoveredDecoration: vscode.TextEditorDecorationType;
let currentReport: CoverageReport | undefined;

const codeLensProvider = new CoverageCodeLensProvider();
const hoverProvider = new CoverageHoverProvider();
const treeProvider = new CoverageTreeProvider();

export function activate(context: vscode.ExtensionContext) {
  createDecorations();
  initStatusBar(context);

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ language: 'python' }, codeLensProvider),
    vscode.languages.registerHoverProvider({ language: 'python' }, hoverProvider),
    vscode.window.registerTreeDataProvider('coverageVisualizer.filesView', treeProvider),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('coverage-visualizer.show', loadAndApply),
    vscode.commands.registerCommand('coverage-visualizer.clear', clearCoverage),
    vscode.commands.registerCommand('coverage-visualizer.showDashboard', () => {
      if (currentReport) {
        showDashboard(currentReport, context);
      } else {
        loadAndApply().then(() => {
          if (currentReport) showDashboard(currentReport, context);
        });
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && currentReport) applyToEditor(editor, currentReport);
    }),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('coverageVisualizer')) return;
      coveredDecoration.dispose();
      uncoveredDecoration.dispose();
      createDecorations();
      if (currentReport) {
        vscode.window.visibleTextEditors.forEach(ed => applyToEditor(ed, currentReport!));
        codeLensProvider.setReport(currentReport);
      }
    }),
  );

  setupWatchers(context);
}

function createDecorations() {
  const cfg = getConfig();
  coveredDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: cfg.coveredColor,
    overviewRulerColor: 'rgba(0, 180, 0, 0.8)',
    overviewRulerLane: vscode.OverviewRulerLane.Left,
    isWholeLine: true,
  });
  uncoveredDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: cfg.uncoveredColor,
    overviewRulerColor: 'rgba(220, 50, 50, 0.8)',
    overviewRulerLane: vscode.OverviewRulerLane.Left,
    isWholeLine: true,
  });
}

function setupWatchers(context: vscode.ExtensionContext) {
  const root = vscode.workspace.workspaceFolders?.[0];
  if (!root) return;

  const patterns = ['coverage.json', 'coverage.xml', '.coverage'];
  patterns.forEach(pattern => {
    const w = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(root, pattern)
    );
    const reload = () => { if (getConfig().autoReloadOnChange) loadAndApply(); };
    w.onDidCreate(reload);
    w.onDidChange(reload);
    w.onDidDelete(() => {
      if (!findAnyCoverageFile(root.uri.fsPath)) clearCoverage();
    });
    context.subscriptions.push(w);
  });
}

async function loadAndApply() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceFolder) return;

  const result = await detectAndParse(workspaceFolder);
  if (!result) {
    vscode.window.showWarningMessage(
      'Coverage Visualizer: No coverage file found. Run: pytest --cov=. --cov-report=json'
    );
    return;
  }

  const { report, formatUsed } = result;
  currentReport = report;

  codeLensProvider.setReport(report);
  hoverProvider.setReport(report);
  treeProvider.setReport(report);

  vscode.window.visibleTextEditors.forEach(editor => applyToEditor(editor, currentReport!));
  updateStatusBar(report);
  updateDashboard(report);

  const { percentCovered, coveredStatements, numStatements } = report.totals;
  vscode.window.showInformationMessage(
    `Coverage [${formatUsed}]: ${percentCovered.toFixed(1)}% — ${coveredStatements}/${numStatements} statements`
  );
}

async function detectAndParse(
  workspaceFolder: string
): Promise<{ report: CoverageReport; formatUsed: string } | undefined> {

  const jsonPath = path.join(workspaceFolder, 'coverage.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as RawCoverageJson;
      return { report: parseCoverageJson(raw), formatUsed: 'coverage.json' };
    } catch { /* fall through */ }
  }

  const xmlPath = path.join(workspaceFolder, 'coverage.xml');
  if (fs.existsSync(xmlPath)) {
    try {
      return { report: parseCoverageXml(fs.readFileSync(xmlPath, 'utf-8')), formatUsed: 'coverage.xml' };
    } catch { /* fall through */ }
  }

  const sqlitePath = path.join(workspaceFolder, '.coverage');
  if (fs.existsSync(sqlitePath)) {
    try {
      return { report: await parseCoverageSqlite(sqlitePath, workspaceFolder), formatUsed: '.coverage' };
    } catch (err) {
      vscode.window.showErrorMessage(
        `Coverage Visualizer: Failed to read .coverage — ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return undefined;
}

function findAnyCoverageFile(workspaceFolder: string): boolean {
  return ['coverage.json', 'coverage.xml', '.coverage'].some(f =>
    fs.existsSync(path.join(workspaceFolder, f))
  );
}

function clearCoverage() {
  currentReport = undefined;
  codeLensProvider.setReport(undefined);
  hoverProvider.setReport(undefined);
  treeProvider.setReport(undefined);
  clearStatusBar();
  vscode.window.visibleTextEditors.forEach(editor => {
    editor.setDecorations(coveredDecoration, []);
    editor.setDecorations(uncoveredDecoration, []);
  });
}


function applyToEditor(editor: vscode.TextEditor, report: CoverageReport) {
  const fileCoverage = findFileInReport(report, editor.document.uri.fsPath);
  if (!fileCoverage) {
    editor.setDecorations(coveredDecoration, []);
    editor.setDecorations(uncoveredDecoration, []);
    return;
  }
  editor.setDecorations(coveredDecoration, linesToDecorations(fileCoverage.executedLines));
  editor.setDecorations(uncoveredDecoration, linesToDecorations(fileCoverage.missingLines));
}

function linesToDecorations(lines: number[]): vscode.DecorationOptions[] {
  return toLineRanges(lines).map(({ start, end }) => ({
    range: new vscode.Range(start - 1, 0, end - 1, Number.MAX_SAFE_INTEGER),
  }));
}

export function deactivate() {
  coveredDecoration?.dispose();
  uncoveredDecoration?.dispose();
  currentReport = undefined;
}
