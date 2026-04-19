import * as vscode from 'vscode';

export interface Config {
  thresholdGood: number;
  thresholdWarn: number;
  coveredColor: string;
  uncoveredColor: string;
  enableCodeLens: boolean;
  enableHoverMessages: boolean;
  autoReloadOnChange: boolean;
}

export function getConfig(): Config {
  const cfg = vscode.workspace.getConfiguration('coverageVisualizer');
  return {
    thresholdGood: cfg.get<number>('thresholdGood', 80),
    thresholdWarn: cfg.get<number>('thresholdWarn', 50),
    coveredColor: cfg.get<string>('coveredHighlightColor', 'rgba(0, 180, 0, 0.10)'),
    uncoveredColor: cfg.get<string>('uncoveredHighlightColor', 'rgba(220, 50, 50, 0.10)'),
    enableCodeLens: cfg.get<boolean>('enableCodeLens', true),
    enableHoverMessages: cfg.get<boolean>('enableHoverMessages', true),
    autoReloadOnChange: cfg.get<boolean>('autoReloadOnChange', true),
  };
}
