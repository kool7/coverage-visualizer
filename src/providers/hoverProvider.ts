import * as vscode from 'vscode';
import { CoverageReport, findFileInReport } from '../parsers/coverageParser.js';
import { getConfig } from '../config.js';

export class CoverageHoverProvider implements vscode.HoverProvider {
  private report: CoverageReport | undefined;

  setReport(report: CoverageReport | undefined) {
    this.report = report;
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Hover | undefined {
    if (!getConfig().enableHoverMessages || !this.report) return;

    const fileCoverage = findFileInReport(this.report, document.uri.fsPath);
    if (!fileCoverage) return;

    const line = position.line + 1;
    const range = new vscode.Range(position.line, 0, position.line, Number.MAX_SAFE_INTEGER);

    if (fileCoverage.missingLines.includes(line)) {
      const msg = new vscode.MarkdownString('$(error) **Not covered** — no test exercises this line');
      msg.supportThemeIcons = true;
      return new vscode.Hover(msg, range);
    }

    if (fileCoverage.executedLines.includes(line)) {
      const msg = new vscode.MarkdownString('$(pass) **Covered** — this line is executed by tests');
      msg.supportThemeIcons = true;
      return new vscode.Hover(msg, range);
    }
  }
}
