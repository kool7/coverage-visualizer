// Minimal vscode API mock for Jest — only what extension.ts and coverageParser.ts use
const OverviewRulerLane = { Left: 1, Center: 2, Right: 4, Full: 7 };

const Range = jest.fn().mockImplementation((startLine: number, startChar: number, endLine: number, endChar: number) => ({
  start: { line: startLine, character: startChar },
  end: { line: endLine, character: endChar },
}));

const window = {
  createTextEditorDecorationType: jest.fn().mockReturnValue({
    dispose: jest.fn(),
    key: 'mock-decoration',
  }),
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  visibleTextEditors: [] as unknown[],
  onDidChangeActiveTextEditor: jest.fn().mockReturnValue({ dispose: jest.fn() }),
};

const workspace = {
  workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
  getConfiguration: jest.fn().mockReturnValue({
    get: jest.fn().mockReturnValue('.coverage'),
  }),
};

const commands = {
  registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
};

export { OverviewRulerLane, Range, window, workspace, commands };
