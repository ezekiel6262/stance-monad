import { build } from 'esbuild';

const root = process.cwd();

await build({
  absWorkingDir: root,
  entryPoints: ['./wallet.js'],
  outfile: 'wallet.bundle.js',
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'iife',
});
