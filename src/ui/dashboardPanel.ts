import * as vscode from 'vscode';
import * as path from 'path';
import { CoverageReport } from '../parsers/coverageParser.js';
import { getConfig } from '../config.js';

let panel: vscode.WebviewPanel | undefined;

export function showDashboard(report: CoverageReport, context: vscode.ExtensionContext) {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside);
  } else {
    panel = vscode.window.createWebviewPanel(
      'coverageDashboard',
      'Coverage Dashboard',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    panel.onDidDispose(() => { panel = undefined; }, null, context.subscriptions);
  }

  panel.webview.html = buildHtml(report);

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

  panel.webview.onDidReceiveMessage(msg => {
    if (msg.command === 'openFile') {
      const absolutePath = path.isAbsolute(msg.path)
        ? msg.path
        : path.join(workspaceRoot, msg.path);
      vscode.workspace.openTextDocument(absolutePath).then(doc =>
        vscode.window.showTextDocument(doc, vscode.ViewColumn.One)
      );
    }
  });
}

export function updateDashboard(report: CoverageReport) {
  if (panel) panel.webview.html = buildHtml(report);
}

function colorClass(pct: number, thresholdGood: number, thresholdWarn: number): string {
  return pct >= thresholdGood ? 'good' : pct >= thresholdWarn ? 'warn' : 'bad';
}

function buildHtml(report: CoverageReport): string {
  const { percentCovered, coveredStatements, numStatements } = report.totals;
  const { thresholdGood, thresholdWarn } = getConfig();
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

  const files = Object.entries(report.files)
    .filter(([, data]) => data.executedLines.length + data.missingLines.length > 0)
    .map(([filePath, data]) => {
      const displayPath = filePath.startsWith(workspaceRoot)
        ? filePath.slice(workspaceRoot.length).replace(/^[\\/]/, '')
        : filePath;
      return { filePath, displayPath, ...data };
    })
    .sort((a, b) => a.percentCovered - b.percentCovered);

  const fileRows = files.map(f => {
    const pct = f.percentCovered.toFixed(1);
    const cls = colorClass(f.percentCovered, thresholdGood, thresholdWarn);
    const total = f.executedLines.length + f.missingLines.length;
    return `
      <tr class="file-row" data-path="${f.filePath}" data-name="${f.displayPath.toLowerCase()}" data-pct="${f.percentCovered}">
        <td class="filename">${f.displayPath}</td>
        <td class="stat">${f.executedLines.length}/${total}</td>
        <td class="bar-cell">
          <div class="bar-track">
            <div class="bar-fill ${cls}" style="width:${pct}%"></div>
          </div>
        </td>
        <td class="pct ${cls}">${pct}%</td>
      </tr>`;
  }).join('');

  const ringColor = percentCovered >= thresholdGood ? '#4caf82'
    : percentCovered >= thresholdWarn ? '#e8a838' : '#e05c5c';
  const circumference = 2 * Math.PI * 54;
  const filled = circumference * (percentCovered / 100);
  const gap = circumference - filled;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Coverage Dashboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 24px;
  }
  h1 { font-size: 1.3em; font-weight: 600; margin-bottom: 24px; opacity: 0.9; }
  .summary {
    display: flex; align-items: center; gap: 40px;
    margin-bottom: 24px; padding: 20px 24px;
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-widget-border, #333);
    border-radius: 8px;
  }
  .ring-wrap { flex-shrink: 0; }
  svg.ring { width: 120px; height: 120px; }
  .ring-bg { fill: none; stroke: var(--vscode-widget-border, #333); stroke-width: 10; }
  .ring-fill { fill: none; stroke-width: 10; stroke-linecap: round;
    transform: rotate(-90deg); transform-origin: 60px 60px;
    transition: stroke-dasharray 0.6s ease; }
  .ring-label { font-size: 18px; font-weight: 700; fill: var(--vscode-foreground); }
  .ring-sub { font-size: 10px; fill: var(--vscode-descriptionForeground); }
  .stats { display: flex; flex-direction: column; gap: 8px; }
  .stat-row { display: flex; gap: 8px; align-items: baseline; }
  .stat-num { font-size: 1.6em; font-weight: 700; }
  .stat-label { opacity: 0.6; font-size: 0.85em; }
  .toolbar {
    display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
  }
  .toolbar-left { display: flex; align-items: center; gap: 8px; flex: 1; }
  h2 { font-size: 1em; font-weight: 600; opacity: 0.8;
    text-transform: uppercase; letter-spacing: 0.05em; }
  .file-count { opacity: 0.45; font-size: 0.82em; }
  .sort-btn {
    background: var(--vscode-button-secondaryBackground, #3c3c3c);
    color: var(--vscode-button-secondaryForeground, #ccc);
    border: 1px solid var(--vscode-widget-border, #555);
    border-radius: 4px; padding: 3px 9px; font-size: 0.82em;
    cursor: pointer; display: flex; align-items: center; gap: 4px;
    white-space: nowrap;
  }
  .sort-btn:hover { background: var(--vscode-button-secondaryHoverBackground, #4a4a4a); }
  .filter-input {
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, #555);
    color: var(--vscode-input-foreground);
    border-radius: 4px; padding: 4px 10px; font-size: 0.9em; width: 200px;
    outline: none;
  }
  .filter-input:focus { border-color: var(--vscode-focusBorder, #007fd4); }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 6px 10px; opacity: 0.5;
    font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.05em;
    border-bottom: 1px solid var(--vscode-widget-border, #333); }
  .file-row { cursor: pointer; transition: background 0.15s; }
  .file-row:hover { background: var(--vscode-list-hoverBackground); }
  .file-row.hidden { display: none; }
  td { padding: 8px 10px; vertical-align: middle;
    border-bottom: 1px solid var(--vscode-widget-border, #222); }
  .filename {
    font-family: var(--vscode-editor-font-family, monospace); font-size: 0.9em;
    color: var(--vscode-textLink-foreground, #4daafc);
    text-decoration: underline; text-underline-offset: 2px;
  }
  .file-row:hover .filename { text-decoration: none; }
  .stat { text-align: right; opacity: 0.6; font-size: 0.85em; white-space: nowrap; }
  .bar-cell { width: 40%; padding: 8px 12px; }
  .bar-track { height: 6px; background: var(--vscode-widget-border, #333); border-radius: 3px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
  .pct { text-align: right; font-weight: 600; white-space: nowrap; min-width: 52px; }
  .good { color: #4caf82; background: #4caf82; }
  .warn { color: #e8a838; background: #e8a838; }
  .bad  { color: #e05c5c; background: #e05c5c; }
  .pct.good, .pct.warn, .pct.bad { background: none; }
  .no-results { padding: 16px 10px; opacity: 0.5; font-style: italic; display: none; }
  .source-tag { margin-top: 20px; opacity: 0.4; font-size: 0.78em; }
</style>
</head>
<body>
<h1>Coverage Dashboard</h1>

<div class="summary">
  <div class="ring-wrap">
    <svg class="ring" viewBox="0 0 120 120">
      <circle class="ring-bg" cx="60" cy="60" r="54"/>
      <circle class="ring-fill"
        cx="60" cy="60" r="54"
        stroke="${ringColor}"
        stroke-dasharray="${filled} ${gap}"/>
      <text class="ring-label" x="60" y="56" text-anchor="middle" dominant-baseline="middle">
        ${percentCovered.toFixed(1)}%
      </text>
      <text class="ring-sub" x="60" y="72" text-anchor="middle">covered</text>
    </svg>
  </div>
  <div class="stats">
    <div class="stat-row">
      <span class="stat-num">${coveredStatements}</span>
      <span class="stat-label">/ ${numStatements} statements covered</span>
    </div>
    <div class="stat-row">
      <span class="stat-num">${files.filter(f => f.percentCovered === 100).length}</span>
      <span class="stat-label">files fully covered</span>
    </div>
    <div class="stat-row">
      <span class="stat-num" style="color:#e05c5c">${files.filter(f => f.percentCovered === 0).length}</span>
      <span class="stat-label">files with zero coverage</span>
    </div>
  </div>
</div>

<div class="toolbar">
  <div class="toolbar-left">
    <h2>Files</h2>
    <span class="file-count">${files.length} total</span>
    <button class="sort-btn" id="sort-btn" title="Toggle sort order">
      <span id="sort-icon">↑</span>
      <span id="sort-label">Lowest first</span>
    </button>
  </div>
  <input class="filter-input" id="filter" type="text" placeholder="Filter files…" autocomplete="off"/>
</div>
<table>
  <thead>
    <tr>
      <th>File</th>
      <th style="text-align:right">Lines</th>
      <th></th>
      <th style="text-align:right">%</th>
    </tr>
  </thead>
  <tbody id="tbody">${fileRows}</tbody>
</table>
<div class="no-results" id="no-results">No files match your filter.</div>

<p class="source-tag">Source: ${report.source}</p>

<script>
  const vscode = acquireVsCodeApi();

  // Click row to open file
  document.querySelectorAll('.file-row').forEach(row => {
    row.addEventListener('click', () => {
      vscode.postMessage({ command: 'openFile', path: row.dataset.path });
    });
  });

  // Filter
  const filterInput = document.getElementById('filter');
  const noResults = document.getElementById('no-results');

  filterInput.addEventListener('input', applyFilter);

  function applyFilter() {
    const q = filterInput.value.toLowerCase();
    let visible = 0;
    document.querySelectorAll('.file-row').forEach(row => {
      const match = !q || row.dataset.name.includes(q);
      row.classList.toggle('hidden', !match);
      if (match) visible++;
    });
    noResults.style.display = visible === 0 ? 'block' : 'none';
  }

  // Sort toggle
  let sortAsc = true;
  const tbody = document.getElementById('tbody');
  const sortBtn = document.getElementById('sort-btn');
  const sortIcon = document.getElementById('sort-icon');
  const sortLabel = document.getElementById('sort-label');

  sortBtn.addEventListener('click', () => {
    sortAsc = !sortAsc;
    sortIcon.textContent = sortAsc ? '↑' : '↓';
    sortLabel.textContent = sortAsc ? 'Lowest first' : 'Highest first';

    const rows = Array.from(tbody.querySelectorAll('.file-row'));
    rows.sort((a, b) => {
      const pa = parseFloat(a.dataset.pct);
      const pb = parseFloat(b.dataset.pct);
      return sortAsc ? pa - pb : pb - pa;
    });
    rows.forEach(r => tbody.appendChild(r));
    applyFilter();
  });
</script>
</body>
</html>`;
}
