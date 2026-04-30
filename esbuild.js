const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: false,
  minify: false,
}).then(() => {
  // Copy sql-wasm.wasm next to the bundled extension.js so it can be located at runtime.
  const wasmSrc = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const wasmDest = path.join(__dirname, 'out', 'sql-wasm.wasm');
  fs.copyFileSync(wasmSrc, wasmDest);
  console.log('Bundled + copied sql-wasm.wasm');
}).catch(() => process.exit(1));
