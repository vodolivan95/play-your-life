import assert from 'node:assert/strict';
import test from 'node:test';

// node --test не предоставляет глобальный localStorage (в отличие от браузера, где
// выполняется реальный код taskTimer.ts) — минимальная заглушка в памяти для юнит-тестов.
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
}
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

const {
  discardTimer, elapsedSeconds, finishTimer, formatElapsed, pauseTimer, readTimer, resumeTimer, startTimer,
} = await import('../src/taskTimer.ts');

test('таймер: старт/пауза/продолжить/завершить суммирует секунды нескольких сессий', () => {
  const t0 = new Date('2026-11-09T10:00:00.000Z');
  startTimer('q1', t0);
  assert.equal(readTimer('q1')?.runningSince, t0.toISOString());
  const paused = pauseTimer('q1', new Date('2026-11-09T10:05:00.000Z')); // +5 мин
  assert.equal(paused?.runningSince, undefined);
  assert.equal(paused?.accumulatedSeconds, 300);
  assert.equal(readTimer('q1')?.accumulatedSeconds, 300);
  resumeTimer('q1', new Date('2026-11-09T10:10:00.000Z'));
  assert.equal(readTimer('q1')?.runningSince, '2026-11-09T10:10:00.000Z');
  const total = finishTimer('q1', new Date('2026-11-09T10:12:30.000Z')); // ещё +2.5 мин
  assert.equal(total, 300 + 150);
  assert.equal(readTimer('q1'), undefined, 'после завершения таймер удаляется');
});

test('таймер: повторная пауза без запуска и resume без таймера ничего не ломают', () => {
  assert.equal(pauseTimer('ghost'), undefined);
  assert.equal(resumeTimer('ghost'), undefined);
  assert.equal(finishTimer('ghost'), 0);
});

test('таймер: несколько пауз подряд не теряют и не удваивают накопленное время', () => {
  const t0 = new Date('2026-11-09T09:00:00.000Z');
  startTimer('q2', t0);
  pauseTimer('q2', new Date('2026-11-09T09:01:00.000Z'));
  const stillPaused = pauseTimer('q2', new Date('2026-11-09T09:05:00.000Z'));
  assert.equal(stillPaused?.accumulatedSeconds, 60, 'повторная пауза не на запущенном таймере не добавляет время');
});

test('elapsedSeconds/formatElapsed — чистые функции без обращения к хранилищу', () => {
  assert.equal(elapsedSeconds({ taskId: 'x', accumulatedSeconds: 90 }), 90);
  assert.equal(elapsedSeconds({ taskId: 'x', accumulatedSeconds: 90, runningSince: '2026-11-09T09:00:00.000Z' }, new Date('2026-11-09T09:01:30.000Z')), 90 + 90);
  assert.equal(formatElapsed(59), '0:59');
  assert.equal(formatElapsed(60), '1:00');
  assert.equal(formatElapsed(3661), '1:01:01');
});

test('discardTimer сбрасывает таймер без возврата времени', () => {
  startTimer('q3', new Date('2026-11-09T09:00:00.000Z'));
  discardTimer('q3');
  assert.equal(readTimer('q3'), undefined);
});
