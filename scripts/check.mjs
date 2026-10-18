import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const extension = path.join(root, 'extension');
const manifest = JSON.parse(readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3) throw new Error('Se requiere Manifest V3.');
if (!existsSync(path.join(extension, manifest.action.default_popup))) {
  throw new Error('No existe el popup declarado en el manifiesto.');
}
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) inspect(absolute);
    else if (/\.(mjs|js)$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ['--check', absolute], { stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) process.exit(result.status ?? 1);
    }
  }
}
for (const directory of ['extension', 'scripts', 'tests']) inspect(path.join(root, directory));
console.log('Sintaxis JavaScript y manifiesto: correctos.');
