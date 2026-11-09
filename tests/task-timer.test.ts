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
  activeTimer, commitFinish, discardTimer, elapsedSeconds, formatElapsed, isTimerStorageCorrupted,
  pauseTimer, peekFinish, readTimer, resumeTimer, startTimer,
} = await import('../src/taskTimer.ts');

test('таймер: старт/пауза/продолжить/завершить суммирует секунды нескольких сессий', () => {
  const t0 = new Date('2026-11-09T10:00:00.000Z');
  startTimer('u1', 'q1', t0);
  assert.equal(readTimer('u1', 'q1')?.runningSince, t0.toISOString());
  const paused = pauseTimer('u1', 'q1', new Date('2026-11-09T10:05:00.000Z')); // +5 мин
  assert.equal(paused?.runningSince, undefined);
  assert.equal(paused?.accumulatedSeconds, 300);
  assert.equal(readTimer('u1', 'q1')?.accumulatedSeconds, 300);
  resumeTimer('u1', 'q1', new Date('2026-11-09T10:10:00.000Z'));
  assert.equal(readTimer('u1', 'q1')?.runningSince, '2026-11-09T10:10:00.000Z');
  const peek = peekFinish('u1', 'q1', new Date('2026-11-09T10:12:30.000Z')); // ещё +2.5 мин
  assert.equal(peek?.seconds, 300 + 150);
  assert.ok(peek?.actionId, 'у таймера есть устойчивый actionId');
  assert.ok(readTimer('u1', 'q1'), 'peekFinish НЕ удаляет таймер (3.1) — он остаётся до commitFinish');
  commitFinish('u1', 'q1');
  assert.equal(readTimer('u1', 'q1'), undefined, 'commitFinish удаляет таймер');
});

test('3.1: actionId сохраняется на всю сессию таймера и переживает повторную попытку завершения', () => {
  startTimer('u1', 'q1a', new Date('2026-11-09T10:00:00.000Z'));
  const first = peekFinish('u1', 'q1a', new Date('2026-11-09T10:01:00.000Z'));
  // Таймер не удалён (peekFinish не коммитит) — повторная попытка (например, после неудачного
  // сохранения в GameState) получает ТОТ ЖЕ actionId, что защищает от задвоения времени.
  const second = peekFinish('u1', 'q1a', new Date('2026-11-09T10:01:05.000Z'));
  assert.equal(first?.actionId, second?.actionId);
  commitFinish('u1', 'q1a');
});

test('3.1: peekFinish на старом таймере без actionId присваивает его и запоминает', () => {
  // Имитация формата, сохранённого версией до 0.76.0 — без поля actionId.
  localStorage.setItem('play-your-life-task-timer-v1:u1', JSON.stringify({ qOld: { taskId: 'qOld', accumulatedSeconds: 42 } }));
  const first = peekFinish('u1', 'qOld');
  assert.ok(first?.actionId, 'actionId присвоен лениво');
  const second = peekFinish('u1', 'qOld');
  assert.equal(first?.actionId, second?.actionId, 'присвоенный actionId сохранён, а не создаётся заново');
  commitFinish('u1', 'qOld');
});

test('3.2: второй таймер того же владельца не запускается, пока первый идёт', () => {
  startTimer('u2', 'a', new Date('2026-11-09T09:00:00.000Z'));
  assert.throws(() => startTimer('u2', 'b', new Date('2026-11-09T09:00:10.000Z')));
  assert.equal(activeTimer('u2', 'a')?.taskId, undefined, 'у самой задачи "a" другого активного таймера нет');
  assert.equal(activeTimer('u2')?.taskId, 'a', 'активный таймер владельца — "a"');
  pauseTimer('u2', 'a', new Date('2026-11-09T09:01:00.000Z'));
  // После паузы можно начать другой.
  startTimer('u2', 'b', new Date('2026-11-09T09:01:05.000Z'));
  assert.throws(() => resumeTimer('u2', 'a', new Date('2026-11-09T09:01:10.000Z')), 'нельзя возобновить, пока "b" идёт');
  commitFinish('u2', 'a'); commitFinish('u2', 'b');
});

test('3.3: таймеры разных владельцев изолированы друг от друга на одном устройстве', () => {
  startTimer('alice', 'shared-id', new Date('2026-11-09T08:00:00.000Z'));
  assert.equal(readTimer('bob', 'shared-id'), undefined, 'у второго владельца с тем же id задачи своего таймера нет');
  startTimer('bob', 'shared-id', new Date('2026-11-09T08:00:00.000Z')); // не конфликтует с alice — не бросает
  assert.ok(readTimer('alice', 'shared-id')?.runningSince);
  assert.ok(readTimer('bob', 'shared-id')?.runningSince);
  commitFinish('alice', 'shared-id'); commitFinish('bob', 'shared-id');
});

test('3.4: повреждённые данные таймера распознаются отдельно от «таймеров нет»', () => {
  assert.equal(isTimerStorageCorrupted('clean-owner'), false);
  localStorage.setItem('play-your-life-task-timer-v1:broken-owner', 'не json{{{');
  assert.equal(isTimerStorageCorrupted('broken-owner'), true);
  assert.equal(readTimer('broken-owner', 'x'), undefined, 'повреждённые данные не крашат чтение');
  localStorage.setItem('play-your-life-task-timer-v1:broken-owner2', '[1,2,3]');
  assert.equal(isTimerStorageCorrupted('broken-owner2'), true, 'массив вместо объекта — тоже повреждение');
});

test('таймер: повторная пауза без запуска и resume без таймера ничего не ломают', () => {
  assert.equal(pauseTimer('u3', 'ghost'), undefined);
  assert.equal(resumeTimer('u3', 'ghost'), undefined);
  assert.equal(peekFinish('u3', 'ghost'), undefined);
});

test('таймер: несколько пауз подряд не теряют и не удваивают накопленное время', () => {
  const t0 = new Date('2026-11-09T09:00:00.000Z');
  startTimer('u4', 'q2', t0);
  pauseTimer('u4', 'q2', new Date('2026-11-09T09:01:00.000Z'));
  const stillPaused = pauseTimer('u4', 'q2', new Date('2026-11-09T09:05:00.000Z'));
  assert.equal(stillPaused?.accumulatedSeconds, 60, 'повторная пауза не на запущенном таймере не добавляет время');
  commitFinish('u4', 'q2');
});

test('elapsedSeconds/formatElapsed — чистые функции без обращения к хранилищу', () => {
  assert.equal(elapsedSeconds({ taskId: 'x', accumulatedSeconds: 90 }), 90);
  assert.equal(elapsedSeconds({ taskId: 'x', accumulatedSeconds: 90, runningSince: '2026-11-09T09:00:00.000Z' }, new Date('2026-11-09T09:01:30.000Z')), 90 + 90);
  assert.equal(formatElapsed(59), '0:59');
  assert.equal(formatElapsed(60), '1:00');
  assert.equal(formatElapsed(3661), '1:01:01');
});

test('discardTimer сбрасывает таймер без возврата времени', () => {
  startTimer('u5', 'q3', new Date('2026-11-09T09:00:00.000Z'));
  discardTimer('u5', 'q3');
  assert.equal(readTimer('u5', 'q3'), undefined);
});
