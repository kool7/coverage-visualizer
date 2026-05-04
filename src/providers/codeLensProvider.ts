import * as vscode from 'vscode';
import * as path from 'path';
import { CoverageReport, findFileInReport } from '../parsers/coverageParser.js';
import { getConfig } from '../config.js';

function isTestFile(fsPath: string): boolean {
  const basename = path.basename(fsPath);
  return basename.startsWith('test_') || basename.endsWith('_test.py') ||
    fsPath.split(path.sep).some(seg => seg === 'tests' || seg === 'test');
}

export class CoverageCodeLensProvider implements vscode.CodeLensProvider {
  private report: CoverageReport | undefined;
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  setReport(report: CoverageReport | undefined) {
    this.report = report;
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const cfg = getConfig();
    if (!cfg.enableCodeLens || !this.report) return [];
    if (cfg.excludeTestFiles && isTestFile(document.uri.fsPath)) return [];

    const fileCoverage = findFileInReport(this.report, document.uri.fsPath);
    if (!fileCoverage) return [];

    const lenses: vscode.CodeLens[] = [];
    const lines = document.getText().split('\n');
    const defRegex = /^(\s*)(async\s+)?def\s+\w+|^(\s*)class\s+\w+/;

    for (let i = 0; i < lines.length; i++) {
      if (!defRegex.test(lines[i])) continue;

      const indent = (lines[i].match(/^(\s*)/) ?? ['', ''])[1].length;
      let endLine = lines.length - 1;

      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].trim()) continue;
        const jIndent = (lines[j].match(/^(\s*)/) ?? ['', ''])[1].length;
        if (jIndent <= indent && defRegex.test(lines[j])) {
          endLine = j - 1;
          break;
        }
      }

      const bodyLines: number[] = [];
      for (let l = i + 2; l <= endLine + 1; l++) bodyLines.push(l);

      const covered = bodyLines.filter(l => fileCoverage.executedLines.includes(l)).length;
      const uncovered = bodyLines.filter(l => fileCoverage.missingLines.includes(l)).length;
      const total = covered + uncovered;
      if (total === 0) continue;

      const pct = Math.round((covered / total) * 100);
      const icon = pct >= cfg.thresholdGood ? '✓' : pct >= cfg.thresholdWarn ? '⚠' : '✗';

      lenses.push(new vscode.CodeLens(new vscode.Range(i, 0, i, 0), {
        title: `${icon} ${pct}% covered (${covered}/${total} lines)`,
        command: '',
      }));
    }

    return lenses;
  }
}
