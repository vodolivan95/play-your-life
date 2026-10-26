// Бюджет веса сборки: сайт не должен незаметно разрастаться. Запуск после `npm run build`:
//   npm run check:budgets
// Числа взяты с версии 0.39.0 (стартовый JS ≈ 413 КБ в сжатом виде) с запасом около 10 %.
// Если вес вырос осознанно — поднимите число здесь и объясните причину в CHANGELOG.md.
import { error, log } from 'node:console';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import process from 'node:process';

const KB = 1024;
const budgets = {
  entryJs: 460 * KB, // главный файл скриптов (gzip): скачивается при первом открытии сайта
  entryCss: 87 * KB, // главный файл стилей (gzip)
  anyJs: 310 * KB, // любой подгружаемый позже файл скриптов (gzip), например 3D
  totalCode: 900 * KB, // все скрипты и стили вместе (gzip)
  anyFile: 3 * 1024 * KB, // любой отдельный файл: картинка, модель, шрифт (без сжатия)
  totalSite: 40 * 1024 * KB, // вся папка dist (без сжатия)
};

const dist = process.argv[2] ?? 'dist';
if (!existsSync(join(dist, 'index.html'))) {
  error(`Нет ${dist}/index.html — сначала выполните npm run build`);
  process.exit(2);
}
const all = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? all(path) : [path];
  });
const gz = (path) => gzipSync(readFileSync(path), { level: 9 }).length;
const kb = (bytes) => `${(bytes / KB).toFixed(1)} КБ`;
const files = all(dist);
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const entry = (pattern) => {
  const match = html.match(pattern);
  return match ? join(dist, match[1].replace(/^\//, '').replace(/^[^/]*\/(?=assets\/)/, '')) : null;
};
const entryJs = entry(/<script[^>]+src="([^"]+\.js)"/);
const entryCss = entry(/<link[^>]+href="([^"]+\.css)"/);

const problems = [];
const report = [];
const check = (name, actual, limit) => {
  report.push(`${actual > limit ? '✗' : '✓'} ${name}: ${kb(actual)} из ${kb(limit)}`);
  if (actual > limit) problems.push(`${name}: ${kb(actual)} больше бюджета ${kb(limit)}`);
};

if (entryJs && existsSync(entryJs)) check('Главный скрипт (gzip)', gz(entryJs), budgets.entryJs);
else problems.push('Не найден главный скрипт в index.html');
if (entryCss && existsSync(entryCss)) check('Главные стили (gzip)', gz(entryCss), budgets.entryCss);
else problems.push('Не найдены главные стили в index.html');

const code = files.filter((path) => /\.(js|css)$/.test(path));
const lazyJs = files.filter((path) => path.endsWith('.js') && path !== entryJs).map((path) => [path, gz(path)]).sort((a, b) => b[1] - a[1])[0];
if (lazyJs) check(`Самый тяжёлый подгружаемый скрипт ${lazyJs[0].split('/').pop()} (gzip)`, lazyJs[1], budgets.anyJs);
check('Все скрипты и стили (gzip)', code.reduce((sum, path) => sum + gz(path), 0), budgets.totalCode);
const biggestFile = files.map((path) => [path, statSync(path).size]).sort((a, b) => b[1] - a[1])[0];
check(`Самый тяжёлый файл ${biggestFile[0].replace(`${dist}/`, '')}`, biggestFile[1], budgets.anyFile);
check('Вся сборка', files.reduce((sum, path) => sum + statSync(path).size, 0), budgets.totalSite);

log(report.join('\n'));
if (problems.length) {
  error(`\nВес сборки превышен:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
log('\nВес сборки в пределах бюджета');
