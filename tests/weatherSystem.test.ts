import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceWeather, automaticTime, automaticWeather, initialWeather, weatherConfig } from '../src/weatherSystem.ts';
import type { WeatherKind } from '../src/weatherSystem.ts';
function run(kind: WeatherKind, seconds: number, current = initialWeather()) { for (let i = 0; i < seconds * 10; i++) current = advanceWeather(current, kind, .1); return current; }
test('Дождь начинается после облачности и постепенно увлажняет город', () => {
  const first = advanceWeather(initialWeather(), 'rain', .1); assert.equal(first.rainIntensity, 0); assert.ok(first.cloudiness > 0 && first.cloudiness < 1);
  const rainy = run('rain', 60); assert.ok(rainy.rainIntensity > .6); assert.ok(rainy.wetness > .8); assert.ok(rainy.trafficSpeed < .85); assert.ok(rainy.pedestrianDensity < .5);
  const drying = run('clear', 20, rainy); assert.ok(drying.wetness > .7); assert.ok(drying.wetness < rainy.wetness);
  const dry = run('clear', 600, rainy); assert.equal(dry.wetness, 0);
});
test('Снег сохраняется после окончания осадков и тает постепенно', () => {
  const snow = run('snow', 80); assert.ok(snow.snowAmount > .5); assert.ok(run('clear', 10, snow).snowAmount > .4); assert.equal(run('clear', 1000, snow).snowAmount, 0);
});
test('Все состояния ограничены; туман уменьшает видимость, гроза усиливает ветер', () => {
  for (const kind of Object.keys(weatherConfig) as WeatherKind[]) { const w = run(kind, 1000); for (const [key, value] of Object.entries(w)) assert.ok(Number.isFinite(value) && value >= 0, `${kind}/${key}`); assert.ok(w.wetness <= 1 && w.snowAmount <= 1); }
  assert.ok(weatherConfig.fog.fogDensity > weatherConfig.clear.fogDensity); assert.ok(weatherConfig.thunderstorm.windStrength > weatherConfig.rain.windStrength);
});
test('AUTO time и игровой цикл предсказуемы', () => {
  assert.equal(automaticTime(12), 'day'); assert.equal(automaticTime(18), 'sunset'); assert.equal(automaticTime(23), 'night');
  assert.equal(automaticWeather(0), 'clear'); assert.equal(automaticWeather(15), 'rain'); assert.equal(automaticWeather(40), 'clear');
});
