import test from 'node:test';
import assert from 'node:assert/strict';
import { describeWeather, formatTemp, parseWeather, weatherEndpoint } from '../src/liveWeather.ts';

const now = Date.UTC(2026, 9, 11, 8, 30);
const sample = (current: Record<string, unknown>) => ({ current: { time: now / 1000 - 900, temperature_2m: 7.6, weather_code: 3, is_day: 1, ...current } });

test('Погода Open-Meteo: градусы, значок и подпись', () => {
  assert.deepEqual(parseWeather(sample({}), now), { temp: 8, code: 3, day: true, time: now / 1000 - 900 });
  assert.deepEqual(describeWeather(3, true), { icon: '☁️', label: 'Пасмурно' });
  assert.deepEqual(describeWeather(0, false), { icon: '🌙', label: 'Ясно' });
  assert.equal(describeWeather(71, true).label, 'Снег');
  assert.equal(formatTemp(8), '+8°');
  assert.equal(formatTemp(-3), '−3°');
  assert.equal(formatTemp(0), '0°');
  assert.ok(weatherEndpoint.includes('latitude=55.669663') && weatherEndpoint.includes('current=temperature_2m,weather_code,is_day'));
});

test('Неполные, странные и устаревшие данные о погоде не показываются', () => {
  assert.equal(parseWeather(null, now), null);
  assert.equal(parseWeather({}, now), null);
  assert.equal(parseWeather(sample({ temperature_2m: '7' }), now), null);
  assert.equal(parseWeather(sample({ temperature_2m: 120 }), now), null);
  assert.equal(parseWeather(sample({ weather_code: 42 }), now), null);
  assert.equal(parseWeather(sample({ is_day: 2 }), now), null);
  assert.equal(parseWeather(sample({ time: now / 1000 - 4 * 3600 }), now), null);
});
