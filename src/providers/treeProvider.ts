import * as vscode from 'vscode';
import * as path from 'path';
import { CoverageReport } from '../parsers/coverageParser.js';
import { getConfig } from '../config.js';

function isTestFile(fsPath: string): boolean {
  const basename = path.basename(fsPath);
  return basename.startsWith('test_') || basename.endsWith('_test.py') ||
    fsPath.split(/[\\/]/).some(seg => seg === 'tests' || seg === 'test');
}

export class CoverageTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private report: CoverageReport | undefined;
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  setReport(report: CoverageReport | undefined) {
    this.report = report;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    if (!this.report) {
      const placeholder = new vscode.TreeItem(
        'No coverage — run "Coverage Visualizer: Show Coverage"',
        vscode.TreeItemCollapsibleState.None,
      );
      placeholder.iconPath = new vscode.ThemeIcon('info');
      return [placeholder];
    }

    const cfg = getConfig();
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

    // Compute filtered totals (excluding empty files and test files) so the
    // Overall line matches the dashboard ring exactly.
    const filteredFiles = Object.entries(this.report.files)
      .filter(([, d]) => d.executedLines.length + d.missingLines.length > 0)
      .filter(([p]) => !cfg.excludeTestFiles || !isTestFile(p))
      .map(([, d]) => d);
    const coveredStatements = filteredFiles.reduce((n, f) => n + f.executedLines.length, 0);
    const numStatements     = filteredFiles.reduce((n, f) => n + f.executedLines.length + f.missingLines.length, 0);
    const percentCovered    = numStatements > 0 ? (coveredStatements / numStatements) * 100 : 0;

    const summaryIcon = percentCovered >= cfg.thresholdGood ? 'shield'
      : percentCovered >= cfg.thresholdWarn ? 'warning' : 'error';
    const summary = new vscode.TreeItem(
      `Overall: ${percentCovered.toFixed(1)}% (${coveredStatements}/${numStatements})`,
      vscode.TreeItemCollapsibleState.None,
    );
    summary.iconPath = new vscode.ThemeIcon(summaryIcon);
    summary.tooltip = `Source: ${this.report.source}`;
    summary.command = { command: 'coverage-visualizer.showDashboard', title: 'Show Dashboard' };

    const fileItems = Object.entries(this.report.files)
      .filter(([, d]) => d.executedLines.length + d.missingLines.length > 0)
      .filter(([filePath]) => !cfg.excludeTestFiles || !isTestFile(filePath))
      .sort(([, a], [, b]) => a.percentCovered - b.percentCovered)
      .map(([filePath, data]) => {
        const displayPath = filePath.startsWith(workspaceRoot)
          ? filePath.slice(workspaceRoot.length).replace(/^[\\/]/, '')
          : filePath;
        const label = displayPath.split(/[\\/]/).pop() ?? displayPath;
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        const total = data.executedLines.length + data.missingLines.length;
        item.description = `${data.percentCovered.toFixed(1)}%  ${data.executedLines.length}/${total}`;
        item.tooltip = new vscode.MarkdownString(
          `**${displayPath}**\n\n${data.executedLines.length}/${total} lines covered`
        );
        item.iconPath = new vscode.ThemeIcon(
          data.percentCovered >= cfg.thresholdGood ? 'pass'
            : data.percentCovered >= cfg.thresholdWarn ? 'warning' : 'error'
        );
        const absolutePath = path.isAbsolute(filePath)
          ? filePath
          : path.join(workspaceRoot, filePath);
        item.command = {
          command: 'vscode.open',
          title: 'Open File',
          arguments: [vscode.Uri.file(absolutePath)],
        };
        return item;
      });

    return [summary, ...fileItems];
  }
}
