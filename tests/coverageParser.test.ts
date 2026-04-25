import { parseCoverageJson, parseCoverageXml, parseCoverageSqlite, findFileInReport, toLineRanges, RawCoverageJson } from '../src/parsers/coverageParser';
import * as fs from 'fs';
import * as path from 'path';

const jsonFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, './fixtures/coverage.json'), 'utf-8')
) as RawCoverageJson;

const xmlFixture = fs.readFileSync(path.join(__dirname, './fixtures/coverage.xml'), 'utf-8');

// ── parseCoverageJson ─────────────────────────────────────────────────────────

describe('parseCoverageJson', () => {
  it('parses all file paths', () => {
    const report = parseCoverageJson(jsonFixture);
    expect(Object.keys(report.files)).toEqual([
      'src/calculator.py',
      'src/utils.py',
      'src/untested.py',
    ]);
  });

  it('maps executed lines correctly', () => {
    const report = parseCoverageJson(jsonFixture);
    expect(report.files['src/calculator.py'].executedLines).toEqual([1, 2, 3, 5, 6, 10, 11, 12]);
  });

  it('maps missing lines correctly', () => {
    const report = parseCoverageJson(jsonFixture);
    expect(report.files['src/calculator.py'].missingLines).toEqual([7, 8, 9]);
  });

  it('handles 100% covered file', () => {
    const report = parseCoverageJson(jsonFixture);
    expect(report.files['src/utils.py'].missingLines).toEqual([]);
    expect(report.files['src/utils.py'].percentCovered).toBe(100);
  });

  it('handles 0% covered file', () => {
    const report = parseCoverageJson(jsonFixture);
    expect(report.files['src/untested.py'].executedLines).toEqual([]);
    expect(report.files['src/untested.py'].percentCovered).toBe(0);
  });

  it('computes totals correctly', () => {
    const report = parseCoverageJson(jsonFixture);
    expect(report.totals.numStatements).toBe(24);
    expect(report.totals.coveredStatements).toBe(13);
    expect(report.totals.percentCovered).toBeCloseTo(54.17, 1);
  });

  it('sets source to json', () => {
    expect(parseCoverageJson(jsonFixture).source).toBe('json');
  });
});

// ── parseCoverageXml ──────────────────────────────────────────────────────────

describe('parseCoverageXml', () => {
  it('parses all file paths', () => {
    const report = parseCoverageXml(xmlFixture);
    expect(Object.keys(report.files)).toEqual([
      'src/calculator.py',
      'src/utils.py',
      'src/untested.py',
    ]);
  });

  it('maps executed lines (hits > 0)', () => {
    const report = parseCoverageXml(xmlFixture);
    expect(report.files['src/calculator.py'].executedLines).toEqual([1, 2, 3, 5, 6, 10, 11, 12]);
  });

  it('maps missing lines (hits = 0)', () => {
    const report = parseCoverageXml(xmlFixture);
    expect(report.files['src/calculator.py'].missingLines).toEqual([7, 8, 9]);
  });

  it('handles 100% covered file', () => {
    const report = parseCoverageXml(xmlFixture);
    expect(report.files['src/utils.py'].missingLines).toHaveLength(0);
    expect(report.files['src/utils.py'].percentCovered).toBe(100);
  });

  it('handles 0% covered file', () => {
    const report = parseCoverageXml(xmlFixture);
    expect(report.files['src/untested.py'].executedLines).toHaveLength(0);
    expect(report.files['src/untested.py'].percentCovered).toBe(0);
  });

  it('sets source to xml', () => {
    expect(parseCoverageXml(xmlFixture).source).toBe('xml');
  });
});

// ── findFileInReport ──────────────────────────────────────────────────────────

describe('findFileInReport', () => {
  const report = parseCoverageJson(jsonFixture);

  it('finds a file by absolute path suffix match', () => {
    const result = findFileInReport(report, '/home/user/project/src/calculator.py');
    expect(result).toBeDefined();
    expect(result!.executedLines).toContain(1);
  });

  it('returns undefined for unknown file', () => {
    expect(findFileInReport(report, '/home/user/project/src/unknown.py')).toBeUndefined();
  });
});

// ── toLineRanges ──────────────────────────────────────────────────────────────

describe('toLineRanges', () => {
  it('returns empty for no lines', () => {
    expect(toLineRanges([])).toEqual([]);
  });

  it('groups consecutive lines into one range', () => {
    expect(toLineRanges([1, 2, 3])).toEqual([{ start: 1, end: 3 }]);
  });

  it('splits non-consecutive lines into separate ranges', () => {
    expect(toLineRanges([1, 2, 5, 6, 10])).toEqual([
      { start: 1, end: 2 },
      { start: 5, end: 6 },
      { start: 10, end: 10 },
    ]);
  });

  it('handles a single line', () => {
    expect(toLineRanges([7])).toEqual([{ start: 7, end: 7 }]);
  });

  it('handles unsorted input', () => {
    expect(toLineRanges([5, 1, 2, 8])).toEqual([
      { start: 1, end: 2 },
      { start: 5, end: 5 },
      { start: 8, end: 8 },
    ]);
  });
});

// ── parseCoverageSqlite ───────────────────────────────────────────────────────

const sqliteFixture = path.join(__dirname, './fixtures/.coverage');
// Source files live in tests/fixtures/src/ so the fixture is self-contained (no demo-python-project needed in CI).
const sqliteWorkspaceRoot = path.join(__dirname, 'fixtures');

describe('parseCoverageSqlite', () => {
  it('reads all three files from the SQLite database', async () => {
    const report = await parseCoverageSqlite(sqliteFixture, sqliteWorkspaceRoot);
    expect(Object.keys(report.files)).toEqual([
      'src/calculator.py',
      'src/utils.py',
      'src/untested.py',
    ]);
  });

  it('decodes executed lines correctly for calculator.py', async () => {
    const report = await parseCoverageSqlite(sqliteFixture, sqliteWorkspaceRoot);
    expect(report.files['src/calculator.py'].executedLines).toEqual([1, 2, 4, 5, 7, 8, 10, 11]);
  });

  it('reports zero executed lines for untested.py', async () => {
    const report = await parseCoverageSqlite(sqliteFixture, sqliteWorkspaceRoot);
    expect(report.files['src/untested.py'].executedLines).toHaveLength(0);
  });

  it('infers missing lines from source for untested.py', async () => {
    const report = await parseCoverageSqlite(sqliteFixture, sqliteWorkspaceRoot);
    // untested.py has code lines — they should all be missing
    expect(report.files['src/untested.py'].missingLines.length).toBeGreaterThan(0);
  });

  it('infers missing lines for partially covered calculator.py', async () => {
    const report = await parseCoverageSqlite(sqliteFixture, sqliteWorkspaceRoot);
    const calc = report.files['src/calculator.py'];
    expect(calc.missingLines.length).toBeGreaterThan(0);
    // No line should appear in both executed and missing
    const overlap = calc.executedLines.filter(l => calc.missingLines.includes(l));
    expect(overlap).toHaveLength(0);
  });

  it('reports 100% for utils.py (all lines executed)', async () => {
    const report = await parseCoverageSqlite(sqliteFixture, sqliteWorkspaceRoot);
    expect(report.files['src/utils.py'].percentCovered).toBe(100);
    expect(report.files['src/utils.py'].missingLines).toHaveLength(0);
  });

  it('sets source to sqlite', async () => {
    const report = await parseCoverageSqlite(sqliteFixture, sqliteWorkspaceRoot);
    expect(report.source).toBe('sqlite');
  });

  it('totals reflect actual covered/total counts', async () => {
    const report = await parseCoverageSqlite(sqliteFixture, sqliteWorkspaceRoot);
    expect(report.totals.coveredStatements).toBe(12); // 8 + 4 + 0
    expect(report.totals.numStatements).toBeGreaterThan(12); // includes missing lines
    expect(report.totals.percentCovered).toBeLessThan(100);
  });
});
