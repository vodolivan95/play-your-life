import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { stdout } from 'node:process';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'public', 'spellcheck');
await mkdir(output, { recursive: true });

for (const language of ['en', 'ru']) {
  const dictionaryDir = resolve(root, 'node_modules', `dictionary-${language}`);
  const [aff, dic] = await Promise.all([
    readFile(resolve(dictionaryDir, 'index.aff'), 'utf8'),
    readFile(resolve(dictionaryDir, 'index.dic'), 'utf8'),
  ]);
  const payload = Buffer.from(JSON.stringify({ aff, dic }), 'utf8');
  const compressed = gzipSync(payload, { level: 9 });
  await writeFile(resolve(output, `${language}.dict`), compressed);
  await copyFile(resolve(dictionaryDir, 'license'), resolve(output, `LICENSE-${language}.txt`));
}

const nspellLicense = await readFile(resolve(root, 'node_modules', 'nspell', 'license'), 'utf8');
await writeFile(resolve(output, 'LICENSE-nspell.txt'), nspellLicense);
stdout.write('Built compressed local spellcheck dictionaries (English and Russian).\n');
