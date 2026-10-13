import path from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();

await build({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'wallet.js')],
  outfile: path.join(root, 'wallet.bundle.js'),
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'iife',
});
