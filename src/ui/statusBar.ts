import * as vscode from 'vscode';
import { CoverageReport } from '../parsers/coverageParser.js';
import { getConfig } from '../config.js';

let statusBarItem: vscode.StatusBarItem | undefined;

export function initStatusBar(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'coverage-visualizer.showDashboard';
  statusBarItem.tooltip = 'Coverage Visualizer — click to open dashboard';
  context.subscriptions.push(statusBarItem);
}

export function updateStatusBar(report: CoverageReport) {
  if (!statusBarItem) return;
  const { percentCovered } = report.totals;
  const { thresholdGood, thresholdWarn } = getConfig();
  const icon = percentCovered >= thresholdGood ? '$(shield)'
    : percentCovered >= thresholdWarn ? '$(warning)' : '$(error)';
  statusBarItem.text = `${icon} ${percentCovered.toFixed(1)}% coverage`;
  statusBarItem.backgroundColor =
    percentCovered < thresholdWarn
      ? new vscode.ThemeColor('statusBarItem.warningBackground')
      : undefined;
  statusBarItem.show();
}

export function clearStatusBar() {
  statusBarItem?.hide();
}
