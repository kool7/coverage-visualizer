import * as fs from 'fs';
import * as path from 'path';
// sql.js is pure JS/WASM — works in VS Code's Electron extension host without native module issues
import initSqlJs from 'sql.js';

export interface FileCoverage {
  executedLines: number[];
  missingLines: number[];
  excludedLines: number[];
  percentCovered: number;
}

export interface CoverageReport {
  files: Record<string, FileCoverage>;
  totals: {
    numStatements: number;
    coveredStatements: number;
    percentCovered: number;
  };
  source: 'json' | 'xml' | 'sqlite';
}

export interface RawCoverageJson {
  files: Record<string, {
    executed_lines: number[];
    missing_lines: number[];
    excluded_lines: number[];
    summary: { percent_covered: number };
  }>;
  totals: {
    num_statements: number;
    covered_lines: number;
    percent_covered: number;
  };
}

// ── JSON (coverage.json) ──────────────────────────────────────────────────────

export function parseCoverageJson(raw: RawCoverageJson): CoverageReport {
  const files: Record<string, FileCoverage> = {};

  for (const [filePath, data] of Object.entries(raw.files)) {
    files[filePath] = {
      executedLines: data.executed_lines,
      missingLines: data.missing_lines,
      excludedLines: data.excluded_lines,
      percentCovered: data.summary.percent_covered,
    };
  }

  return {
    files,
    totals: {
      numStatements: raw.totals.num_statements,
      coveredStatements: raw.totals.covered_lines,
      percentCovered: raw.totals.percent_covered,
    },
    source: 'json',
  };
}

// ── XML / Cobertura (coverage.xml) ───────────────────────────────────────────

export function parseCoverageXml(xmlContent: string): CoverageReport {
  const files: Record<string, FileCoverage> = {};
  let totalStatements = 0;
  let totalCovered = 0;

  const rootMatch = xmlContent.match(/<coverage[^>]+line-rate="([^"]+)"[^>]+lines-valid="([^"]+)"[^>]+lines-covered="([^"]+)"/);
  if (rootMatch) {
    totalStatements = parseInt(rootMatch[2], 10);
    totalCovered = parseInt(rootMatch[3], 10);
  }

  const classRegex = /<class[^>]+filename="([^"]+)"[^>]*>([\s\S]*?)<\/class>/g;
  let classMatch;

  while ((classMatch = classRegex.exec(xmlContent)) !== null) {
    const filePath = classMatch[1];
    const classBody = classMatch[2];

    const executedLines: number[] = [];
    const missingLines: number[] = [];

    const lineRegex = /<line[^>]+number="(\d+)"[^>]+hits="(\d+)"/g;
    let lineMatch;
    while ((lineMatch = lineRegex.exec(classBody)) !== null) {
      const lineNum = parseInt(lineMatch[1], 10);
      const hits = parseInt(lineMatch[2], 10);
      if (hits > 0) {
        executedLines.push(lineNum);
      } else {
        missingLines.push(lineNum);
      }
    }

    const total = executedLines.length + missingLines.length;
    files[filePath] = {
      executedLines,
      missingLines,
      excludedLines: [],
      percentCovered: total > 0 ? (executedLines.length / total) * 100 : 0,
    };
  }

  const percentCovered = totalStatements > 0 ? (totalCovered / totalStatements) * 100 : 0;

  return {
    files,
    totals: { numStatements: totalStatements, coveredStatements: totalCovered, percentCovered },
    source: 'xml',
  };
}

// ── SQLite (.coverage) ───────────────────────────────────────────────────────
// Reads the .coverage SQLite file directly using sql.js (pure JS/WASM).
// coverage.py stores executed line numbers as a compact bitmap (numbits BLOB).

// coverage.py bitmap encoding: bit N set in blob → line number (byte*8 + bit) was executed.
function decodeNumBits(buf: Uint8Array): number[] {
  const lines: number[] = [];
  for (let i = 0; i < buf.length; i++) {
    for (let bit = 0; bit < 8; bit++) {
      if (buf[i] & (1 << bit)) {
        const lineNum = 8 * i + bit;
        if (lineNum > 0) lines.push(lineNum);
      }
    }
  }
  return lines;
}

// Approximate missing lines by reading the source file (non-blank, non-comment lines).
function inferMissingLines(filePath: string, executedSet: Set<number>, workspaceRoot: string): number[] {
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
  if (!fs.existsSync(resolved)) return [];
  const lines = fs.readFileSync(resolved, 'utf-8').split('\n');
  const missing: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    if (executedSet.has(lineNum)) continue;
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#') ||
        trimmed.startsWith('"""') || trimmed.startsWith("'''")) continue;
    missing.push(lineNum);
  }
  return missing;
}

// Lazily initialised sql.js module (loads WASM once, reused on subsequent calls).
let sqlJsReady: Awaited<ReturnType<typeof initSqlJs>> | undefined;

async function getSqlJs() {
  if (!sqlJsReady) {
    // Locate the WASM file relative to this module (works in both dev and packaged extension).
    // require.resolve('sql.js') → .../node_modules/sql.js/dist/sql-wasm.js
    // The WASM file sits alongside the JS file in the same dist/ folder.
    const wasmPath = path.join(
      path.dirname(require.resolve('sql.js')),
      'sql-wasm.wasm',
    );
    sqlJsReady = await initSqlJs({ locateFile: () => wasmPath });
  }
  return sqlJsReady;
}

export async function parseCoverageSqlite(coveragePath: string, workspaceRoot: string): Promise<CoverageReport> {
  const SQL = await getSqlJs();
  const buf = fs.readFileSync(coveragePath);
  const db = new SQL.Database(new Uint8Array(buf));

  try {
    const files: Record<string, FileCoverage> = {};
    let totalStmts = 0;
    let totalCovered = 0;

    const fileRows = db.exec('SELECT id, path FROM file')[0];
    if (!fileRows) return { files: {}, totals: { numStatements: 0, coveredStatements: 0, percentCovered: 0 }, source: 'sqlite' };

    for (const [id, filePath] of fileRows.values as [number, string][]) {
      const stmt = db.prepare('SELECT numbits FROM line_bits WHERE file_id = ?');
      stmt.bind([id]);

      const executedSet = new Set<number>();
      while (stmt.step()) {
        const row = stmt.getAsObject() as { numbits: Uint8Array };
        for (const line of decodeNumBits(row.numbits)) executedSet.add(line);
      }
      stmt.free();

      const executedLines = [...executedSet].sort((a, b) => a - b);
      const missingLines = inferMissingLines(filePath as string, executedSet, workspaceRoot);
      const total = executedLines.length + missingLines.length;

      totalStmts += total;
      totalCovered += executedLines.length;

      files[filePath as string] = {
        executedLines,
        missingLines,
        excludedLines: [],
        percentCovered: total > 0 ? (executedLines.length / total) * 100 : 100,
      };
    }

    return {
      files,
      totals: {
        numStatements: totalStmts,
        coveredStatements: totalCovered,
        percentCovered: totalStmts > 0 ? (totalCovered / totalStmts) * 100 : 100,
      },
      source: 'sqlite',
    };
  } finally {
    db.close();
  }
}

// ── Shared utilities ──────────────────────────────────────────────────────────

export function findFileInReport(
  report: CoverageReport,
  absolutePath: string
): FileCoverage | undefined {
  return Object.entries(report.files).find(([key]) =>
    absolutePath.endsWith(key) || absolutePath.includes(key)
  )?.[1];
}

export function toLineRanges(lines: number[]): Array<{ start: number; end: number }> {
  if (lines.length === 0) return [];

  const sorted = [...lines].sort((a, b) => a - b);
  const ranges: Array<{ start: number; end: number }> = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push({ start, end });
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push({ start, end });
  return ranges;
}
