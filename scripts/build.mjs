import { cpSync, mkdirSync, lstatSync, existsSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.resolve(root, 'dist');
if (path.dirname(destination) !== path.resolve(root) || path.basename(destination) !== 'dist') throw new Error('Salida fuera del proyecto.');
if (existsSync(destination) && lstatSync(destination).isSymbolicLink()) throw new Error('La salida no puede ser un enlace simbólico.');
// Solo se sustituye la carpeta generada comprobada arriba.
rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
cpSync(path.join(root, 'extension'), destination, { recursive: true, force: true });
cpSync(path.join(root, 'LICENSE'), path.join(destination, 'LICENSE.txt'));
console.log(`Extensión preparada en: ${destination}`);
// ZIP estándar sin dependencias. Incluye únicamente los archivos de dist.
const local = [], central = [];
let offset = 0;
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pack(directory, prefix = '') {
  for (const file of readdirSync(directory, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
    const relative = prefix + file.name;
    const absolute = path.join(directory, file.name);
    if (file.isDirectory()) { pack(absolute, relative + '/'); continue; }
    if (!file.isFile()) throw new Error('No se empaquetan enlaces ni archivos especiales.');
    const name = Buffer.from(relative), data = readFileSync(absolute), crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x800, 6);
    head.writeUInt16LE(33, 12); head.writeUInt32LE(crc, 14); head.writeUInt32LE(data.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(name.length, 26);
    local.push(head, name, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x800, 8);
    entry.writeUInt16LE(33, 14); entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(data.length, 20); entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42);
    central.push(entry, name); offset += head.length + name.length + data.length;
  }
}
pack(destination);
const directory = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
const zipPath = path.join(root, 'wallapop-seller-filters.zip');
writeFileSync(zipPath, Buffer.concat([...local, directory, end]));
console.log(`ZIP preparado: ${zipPath}`);
