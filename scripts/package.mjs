import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cliData = fileURLToPath(new URL('../.cache/webos-cli/', import.meta.url));
mkdirSync(cliData, { recursive: true });
// The CLI supports APPDATA as its data directory. Keep its state in the checkout
// cache so packaging also works when the account's home is read-only.
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL('../node_modules/@webos-tools/cli/bin/ares-package.js', import.meta.url)),
  'app', '--outdir', 'dist', '--no-minify'
], { cwd: root, env: { ...process.env, APPDATA: cliData }, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status === null ? 1 : result.status;
