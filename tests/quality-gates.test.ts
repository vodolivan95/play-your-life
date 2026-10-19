import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Проверки качества проекта: версия везде одна, в репозиторий не попали секреты и мусор,
 * ни один тест не забыт в CI, в коде нет отладочных остатков. Запускаются вместе с `npm test`.
 */
const read = (path: string) => readFileSync(path, 'utf8');
const json = (path: string) => JSON.parse(read(path));
function tracked(): string[] {
  try {
    return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\0')
      .filter(Boolean);
  } catch {
    return [];
  }
}
function files(directory: string, extension: RegExp): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path, extension) : extension.test(entry.name) ? [path] : [];
  });
}

test('версия приложения одна во всех местах', () => {
  const version: string = json('package.json').version;
  assert.match(version, /^\d+\.\d+\.\d+$/);
  const lock = json('package-lock.json');
  assert.equal(lock.version, version, 'package-lock.json');
  assert.equal(lock.packages[''].version, version, 'package-lock.json (корень)');
  assert.match(read('index.html'), new RegExp(`<meta name="application-version" content="${version.replaceAll('.', '\\.')}"`), 'index.html');
  assert.match(read('AGENTS.md'), new RegExp(`Текущая версия приложения — \\*\\*${version.replaceAll('.', '\\.')}\\*\\*`), 'AGENTS.md');
  const heading = read('CHANGELOG.md').match(/^## (\d+\.\d+\.\d+)/m);
  assert.equal(heading?.[1], version, 'первая запись CHANGELOG.md');
});

test('в репозитории нет секретов, .env, архивов, сборок и копий проекта', () => {
  const list = tracked();
  if (!list.length) return;
  const forbidden = /(^|\/)(\.env(\.(?!example$)[^/]*)?|node_modules|dist)(\/|$)|\.(zip|tar|tgz|gz|7z|rar|pem|p12|pfx|jks|keystore)$/i;
  assert.deepEqual(list.filter((path) => forbidden.test(path)), []);
  const patterns: [string, RegExp][] = [
    ['закрытый ключ', /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
    ['токен GitHub', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/],
    ['ключ AWS', /\bAKIA[0-9A-Z]{16}\b/],
    ['ключ API (sk-)', /\bsk-[A-Za-z0-9_-]{32,}/],
    ['токен Slack', /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
    ['секрет TickTick/Cloudflare в коде', /(client_secret|CLIENT_SECRET)\s*[:=]\s*['"][A-Za-z0-9_-]{16,}['"]/],
  ];
  const text = /\.(ts|tsx|js|mjs|cjs|json|md|html|css|toml|yml|yaml|rules|txt|example)$/i;
  for (const path of list) {
    if (!text.test(path) || statSync(path).size > 2 * 1024 * 1024) continue;
    const content = read(path);
    for (const [name, pattern] of patterns)
      assert.doesNotMatch(content, pattern, `${path}: похоже на ${name}`);
  }
  const ignore = read('.gitignore');
  for (const entry of ['node_modules', 'dist', '.env']) assert.match(ignore, new RegExp(`^${entry.replace('.', '\\.')}`, 'm'), `.gitignore: ${entry}`);
});

test('ни один отслеживаемый файл не раздувает репозиторий', () => {
  const list = tracked();
  if (!list.length) return;
  const limit = 6 * 1024 * 1024;
  assert.deepEqual(
    list.filter((path) => statSync(path).size > limit).map((path) => `${path} (${(statSync(path).size / 1048576).toFixed(1)} МБ)`),
    [],
    'файлы тяжелее 6 МБ нужно сжать или не добавлять',
  );
});

test('каждый тест подключён: юнит-тесты в npm test, браузерные — в CI', () => {
  const pkg = json('package.json');
  assert.match(pkg.scripts.test, /tests\/\*\.test\.ts/, 'npm test берёт все tests/*.test.ts');
  const ci = read('.github/workflows/ci.yml');
  const scripts: Record<string, string> = pkg.scripts;
  const forgotten = readdirSync('tests')
    .filter((name) => name.endsWith('.mjs'))
    .filter((name) => {
      if (ci.includes(`tests/${name}`)) return false;
      return !Object.entries(scripts).some(([script, command]) => command.includes(`tests/${name}`) && ci.includes(`npm run ${script}`));
    });
  assert.deepEqual(forgotten, [], 'эти UI-тесты не запускаются в CI');
});

test('в коде приложения нет отладочных остатков', () => {
  const found: string[] = [];
  for (const path of [...files('src', /\.(ts|tsx)$/), ...readdirSync('tests').filter((n) => n.endsWith('.test.ts')).map((n) => join('tests', n))]) {
    read(path).split('\n').forEach((line, index) => {
      const code = line.replace(/\/\/.*$/, '');
      if (/\bconsole\.log\(|\bdebugger\b|\b(test|it|describe)\.only\(/.test(code)) found.push(`${path}:${index + 1}`);
    });
  }
  assert.deepEqual(found, []);
});

test('страница и правила базы: язык, масштаб телефона, нет «открыто всем»', () => {
  const html = read('index.html');
  assert.match(html, /<html lang="ru">/);
  assert.match(html, /<meta name="viewport" content="[^"]*width=device-width/);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.doesNotMatch(read('firestore.rules'), /allow\s+[^;]*:\s*if\s+true\s*;/, 'правила Firestore не должны открывать данные всем');
  for (const path of files('src', /\.(ts|tsx)$/))
    assert.doesNotMatch(read(path), /TICKTICK_CLIENT_SECRET|client_secret/i, `${path}: секрет TickTick не должен попадать в клиент`);
});
