import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec, spawn } from 'child_process';
import {
  parseCoverageJson,
  parseCoverageXml,
  parseCoverageSqlite,
  findFileInReport,
  toLineRanges,
  CoverageReport,
  RawCoverageJson,
} from './parsers/coverageParser.js';
import { initStatusBar, updateStatusBar, clearStatusBar, showRunningStatusBar } from './ui/statusBar.js';
import { showDashboard, updateDashboard } from './ui/dashboardPanel.js';
import { getConfig } from './config.js';
import { CoverageCodeLensProvider } from './providers/codeLensProvider.js';
import { CoverageHoverProvider } from './providers/hoverProvider.js';
import { CoverageTreeProvider } from './providers/treeProvider.js';

let coveredDecoration: vscode.TextEditorDecorationType;
let uncoveredDecoration: vscode.TextEditorDecorationType;
let currentReport: CoverageReport | undefined;
let coverageRunInProgress = false;
let noCoveragePromptActive = false;
let reloadTimer: ReturnType<typeof setTimeout> | undefined;
let testChangeTimer: ReturnType<typeof setTimeout> | undefined;
let coverageOutputChannel: vscode.OutputChannel | undefined;
let runningProc: ReturnType<typeof spawn> | undefined;
let cachedPytestEnv: { hasPytestCov: boolean; hasCoverage: boolean } | undefined;

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
      cachedPytestEnv = undefined;
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

  const debouncedReload = () => {
    if (!getConfig().autoReloadOnChange) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => loadAndApply(), 500);
  };

  const patterns = ['coverage.json', 'coverage.xml', '.coverage'];
  patterns.forEach(pattern => {
    const w = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(root, pattern)
    );
    w.onDidCreate(debouncedReload);
    w.onDidChange(debouncedReload);
    w.onDidDelete(() => {
      if (!findAnyCoverageFile(root.uri.fsPath)) clearCoverage();
    });
    context.subscriptions.push(w);
  });

  const testWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(root, '{test_*.py,*_test.py,tests/**/*.py,test/**/*.py,**/conftest.py}')
  );
  const debouncedTestRun = () => {
    if (!getConfig().autoRunOnTestChange) return;
    clearTimeout(testChangeTimer);
    testChangeTimer = setTimeout(() => runPytestSilently(root.uri.fsPath), 2000);
  };
  testWatcher.onDidChange(debouncedTestRun);
  testWatcher.onDidCreate(debouncedTestRun);
  testWatcher.onDidDelete(debouncedTestRun);
  context.subscriptions.push(testWatcher);
}

async function loadAndApply() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceFolder) return;

  const result = await detectAndParse(workspaceFolder);
  if (!result) {
    if (!coverageRunInProgress && !findAnyCoverageFile(workspaceFolder)) {
      await handleNoCoverage(workspaceFolder);
    }
    return;
  }
  coverageRunInProgress = false;

  const { report } = result;
  currentReport = report;

  codeLensProvider.setReport(report);
  hoverProvider.setReport(report);
  treeProvider.setReport(report);

  vscode.window.visibleTextEditors.forEach(editor => applyToEditor(editor, currentReport!));

  const { excludeTestFiles } = getConfig();
  const filteredFiles = Object.entries(report.files)
    .filter(([p]) => !excludeTestFiles || !isTestFile(p))
    .map(([, d]) => d);
  const filteredCovered = filteredFiles.reduce((n, f) => n + f.executedLines.length, 0);
  const filteredTotal   = filteredFiles.reduce((n, f) => n + f.executedLines.length + f.missingLines.length, 0);
  updateStatusBar({
    percentCovered: filteredTotal > 0 ? (filteredCovered / filteredTotal) * 100 : 0,
    coveredStatements: filteredCovered,
    numStatements: filteredTotal,
  });

  updateDashboard(report);
}

function resolvePython(workspaceFolder: string): string {
  const candidates = [
    path.join(workspaceFolder, '.venv', 'bin', 'python'),
    path.join(workspaceFolder, '.venv', 'Scripts', 'python.exe'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return 'python';
}

function checkPython(python: string, cwd: string, code: string): Promise<boolean> {
  return new Promise(resolve => {
    exec(`"${python}" -c "${code}"`, { cwd }, err => resolve(!err));
  });
}

function spawnPytest(python: string, args: string[], workspaceFolder: string) {
  coverageRunInProgress = true;
  showRunningStatusBar();
  coverageOutputChannel ??= vscode.window.createOutputChannel('Coverage Run');
  coverageOutputChannel.appendLine(`\n${'─'.repeat(60)}`);
  coverageOutputChannel.appendLine(`$ ${python} ${args.join(' ')}\n`);

  runningProc = spawn(python, args, { cwd: workspaceFolder });
  runningProc.stdout!.on('data', (d: Buffer) => coverageOutputChannel!.append(d.toString()));
  runningProc.stderr!.on('data', (d: Buffer) => coverageOutputChannel!.append(d.toString()));
  runningProc.on('close', code => {
    runningProc = undefined;
    coverageRunInProgress = false;
    coverageOutputChannel!.appendLine(`\n[exited ${code ?? '?'}]`);
    if (code !== 0) {
      clearStatusBar();
      vscode.window.showWarningMessage('pytest failed — check the Coverage Run output panel.');
    } else {
      loadAndApply();
    }
  });
}

async function runPytestSilently(workspaceFolder: string) {
  if (coverageRunInProgress) return;
  coverageRunInProgress = true;
  try {
    const python = resolvePython(workspaceFolder);
    if (!cachedPytestEnv) {
      const [hasPytestCov, hasCoverage] = await Promise.all([
        checkPython(python, workspaceFolder, 'import pytest_cov'),
        checkPython(python, workspaceFolder, 'import coverage'),
      ]);
      cachedPytestEnv = { hasPytestCov, hasCoverage };
    }
    if (!cachedPytestEnv.hasCoverage) {
      coverageRunInProgress = false;
      return;
    }
    const args = cachedPytestEnv.hasPytestCov
      ? ['-m', 'pytest', '--cov=.', '--cov-report=json']
      : ['-m', 'coverage', 'run', '-m', 'pytest'];
    spawnPytest(python, args, workspaceFolder);
  } catch {
    coverageRunInProgress = false;
  }
}

async function handleNoCoverage(workspaceFolder: string) {
  if (noCoveragePromptActive) return;
  noCoveragePromptActive = true;

  try {
    const python = resolvePython(workspaceFolder);
    const [hasPytestCov, hasCoverage] = await Promise.all([
      checkPython(python, workspaceFolder, 'import pytest_cov'),
      checkPython(python, workspaceFolder, 'import coverage'),
    ]);

    if (!hasCoverage) {
      vscode.window.showWarningMessage('coverage is not installed — add it as a dev dependency to enable auto-run.');
      return;
    }

    const choice = await vscode.window.showInformationMessage(
      'No coverage found.',
      'Run pytest',
      'Cancel'
    );
    if (choice !== 'Run pytest') return;

    const args = hasPytestCov
      ? ['-m', 'pytest', '--cov=.', '--cov-report=json']
      : ['-m', 'coverage', 'run', '-m', 'pytest'];

    coverageOutputChannel?.show(true);
    spawnPytest(python, args, workspaceFolder);
  } finally {
    noCoveragePromptActive = false;
  }
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
    const python = resolvePython(workspaceFolder);
    const generated = await new Promise<boolean>(resolve => {
      exec(`"${python}" -m coverage json`, { cwd: workspaceFolder }, err => resolve(!err));
    });
    if (generated && fs.existsSync(jsonPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as RawCoverageJson;
        return { report: parseCoverageJson(raw), formatUsed: 'coverage.json' };
      } catch { /* fall through */ }
    }
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

function isTestFile(fsPath: string): boolean {
  const basename = path.basename(fsPath);
  return basename.startsWith('test_') || basename.endsWith('_test.py') ||
    fsPath.split(path.sep).some(seg => seg === 'tests' || seg === 'test');
}

function applyToEditor(editor: vscode.TextEditor, report: CoverageReport) {
  if (getConfig().excludeTestFiles && isTestFile(editor.document.uri.fsPath)) {
    editor.setDecorations(coveredDecoration, []);
    editor.setDecorations(uncoveredDecoration, []);
    return;
  }
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
  clearTimeout(reloadTimer);
  clearTimeout(testChangeTimer);
  runningProc?.kill();
  coveredDecoration?.dispose();
  uncoveredDecoration?.dispose();
  coverageOutputChannel?.dispose();
  currentReport = undefined;
}
