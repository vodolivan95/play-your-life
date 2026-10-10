import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assembleFromCloud,
  cloudWrites,
  HISTORY_KEEP_DAYS,
  isCloudForm,
  splitForCloud,
  unusedImages,
} from '../src/cloudSplit.ts';
import { initialState } from '../src/game.ts';
import type { Event, GameState } from '../src/game.ts';
import { validateState } from '../src/stateValidation.ts';
import { restoreBackup, backupText } from '../src/backup.ts';

const now = new Date('2026-10-10T12:00:00Z');
const image = 'data:image/jpeg;base64,' + 'A'.repeat(4000);
const day = 86_400_000;

function event(id: string, daysAgo: number): Event {
  return {
    id,
    sphere: 'sport',
    title: `Событие ${id}`,
    xp: 10,
    date: new Date(now.getTime() - daysAgo * day).toISOString(),
    kind: 'quest',
    sourceId: id,
  };
}

function game(): GameState {
  const state = initialState();
  state.profile = { ...state.profile, mode: 'personal', onboardingComplete: true };
  state.events = [event('new', 1), event('old-a', 100), event('old-b', 130), event('mid', HISTORY_KEEP_DAYS - 1)]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  state.goals = [{ ...state.goals[0], image }];
  state.quests = [{ ...state.quests[0], coverImage: image }, state.quests[1]];
  return state;
}

test('облачная форма: старые события в архиве, обложки отдельно', () => {
  const full = game();
  const part = splitForCloud(full, now);
  assert.deepEqual(part.stored.events.map((e) => e.id), ['new', 'mid']);
  assert.deepEqual(Object.keys(part.history).sort(), ['2026-06', '2026-07']);
  assert.equal(part.stored.goals[0].image, undefined);
  assert.equal(part.stored.quests[0].coverImage, undefined);
  assert.equal(Object.keys(part.images).length, 2);
  assert.ok(isCloudForm(part.stored));
  validateState(part.stored);
  // Облачная форма меньше полной.
  assert.ok(JSON.stringify(part.stored).length < JSON.stringify(full).length - 7000);
});

test('сборка возвращает игру без потерь', () => {
  const full = game();
  const part = splitForCloud(full, now);
  const assembled = assembleFromCloud(part.stored, part.history, part.images);
  assert.deepEqual(assembled, full);
  assert.equal(assembled.historyIndex, undefined);
  assert.equal(assembled.imageRefs, undefined);
  // Резервная копия собранной игры проходит проверку.
  assert.deepEqual(restoreBackup(backupText(assembled)).events, full.events);
});

test('неполный архив или пропавшая обложка не дают собрать игру', () => {
  const part = splitForCloud(game(), now);
  const [month] = Object.keys(part.history);
  assert.throws(() => assembleFromCloud(part.stored, { ...part.history, [month]: [] }, part.images));
  const withoutMonth = { ...part.history };
  delete withoutMonth[month];
  assert.throws(() => assembleFromCloud(part.stored, withoutMonth, part.images));
  assert.throws(() => assembleFromCloud(part.stored, part.history, {}));
});

test('облачная форма не делится повторно, полная игра без вложений не меняется', () => {
  const part = splitForCloud(game(), now);
  assert.equal(splitForCloud(part.stored, now).stored, part.stored);
  const legacy = initialState();
  assert.equal(assembleFromCloud(legacy, {}, {}), legacy);
});

test('пишутся только изменённые месяцы и новые обложки', () => {
  const first = splitForCloud(game(), now);
  assert.equal(cloudWrites(first, null).months.length, 2);
  assert.equal(cloudWrites(first, null).images.length, 2);
  const unchanged = cloudWrites(first, first.stored);
  assert.deepEqual(unchanged, { months: [], images: [] });
  const changed = game();
  changed.goals = [{ ...changed.goals[0], image: image.replace(/A$/, 'B') }];
  changed.events = [...changed.events, event('older', 101)];
  const next = splitForCloud(changed, now);
  const writes = cloudWrites(next, first.stored);
  assert.equal(writes.images.length, 1);
  assert.equal(writes.months.length, 1);
  assert.deepEqual(
    unusedImages(Object.values(first.stored.imageRefs ?? {}), next.stored),
    [first.stored.imageRefs?.['goal:b2']],
  );
});

test('обложка с необычным id остаётся в основном документе', () => {
  const full = game();
  full.quests = [{ ...full.quests[0], id: 'странный id', coverImage: image }];
  const part = splitForCloud(full, now);
  assert.equal(part.stored.quests[0].coverImage, image);
  assert.deepEqual(assembleFromCloud(part.stored, part.history, part.images).quests, full.quests);
});

test('проверка отклоняет поддельные указатели', () => {
  const part = splitForCloud(game(), now);
  assert.throws(() => validateState({ ...part.stored, historyIndex: { '2026-13x': '1-00000000' } }));
  assert.throws(() =>
    validateState({ ...part.stored, imageRefs: { 'goal:b2': 'quest-other-00000000' } }),
  );
});
