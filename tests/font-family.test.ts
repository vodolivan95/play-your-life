import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function files(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(css|tsx?)$/.test(name)) out.push(path);
  }
  return out;
}

// 4 ноября 2026 по прямому поручению Ивана добавлено единственное исключение: у «Цитаты дня»
// на главной (.home-quote-text) засечный Georgia — чтобы мотивационная фраза бросалась в глаза
// на фоне остального интерфейса, целиком набранного Manrope. Новые font-family по-прежнему запрещены.
const ALLOWED_EXTRA_FONTS = [/^Georgia,\s*'Times New Roman',\s*serif$/];

test('шрифт один везде, кроме согласованного исключения для цитаты дня', () => {
  assert.match(readFileSync('src/main.tsx', 'utf8'), /@fontsource-variable\/manrope/);
  const bad: string[] = [];
  for (const file of files('src').filter((f) => f.endsWith('.css'))) {
    for (const match of readFileSync(file, 'utf8').matchAll(/font-family\s*:\s*([^;}]+)/g)) {
      const value = match[1].trim();
      if (!/^(var\(--font\)|inherit)$/.test(value) && !/Manrope Variable/.test(value) && !ALLOWED_EXTRA_FONTS.some((re) => re.test(value))) {
        bad.push(`${file}: ${value}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});
