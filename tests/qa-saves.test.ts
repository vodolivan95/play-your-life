/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backupText, restoreBackup } from '../src/backup.ts';
import { assembleFromCloud, splitForCloud } from '../src/cloudSplit.ts';
import { completeQuest, initialState, migrateState, spheres } from '../src/game.ts';
import type { GameState } from '../src/game.ts';
import { addMoodCheckin, blankSphereReview, finishReview, saveReview } from '../src/keyResults.ts';
import { monthReport, setImportance } from '../src/monthReport.ts';
import { validateState } from '../src/stateValidation.ts';

const now = new Date('2026-10-18T12:00:00Z');
const day = 86_400_000;

function personal(): GameState {
  const s = initialState();
  s.profile = { ...s.profile, mode: 'personal', onboardingComplete: true };
  return s;
}
function heavy(): GameState {
  let s = personal();
  for (const q of s.quests.slice(0, 12)) s = completeQuest(s, q.id);
  for (let i = 0; i < 400; i++) {
    s.events.push({
      id: 'qa-' + i,
      sphere: spheres[i % 9].id,
      title: 'Событие ' + i,
      xp: 5,
      date: new Date(now.getTime() - i * day).toISOString(),
      kind: 'quest',
      sourceId: 'qa-' + i,
    });
  }
  s.events.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  for (let m = 0; m < 12; m++) {
    const d = new Date(Date.UTC(2026, 9 - m, 15));
    const month = d.toISOString().slice(0, 7);
    s = saveReview(
      s,
      month,
      {
        sphereReviews: Object.fromEntries(
          spheres.map((sp) => [sp.id, { ...blankSphereReview(), worked: 'Что удалось '.repeat(20), score: 7 }]),
        ),
        gratitude: 'Спасибо '.repeat(30),
        focuses: ['Фокус 1', 'Фокус 2'],
      } as never,
      d,
    );
    s = finishReview(s, month, d);
    s = addMoodCheckin(s, 3 + (m % 3), 2 + (m % 4), d);
  }
  for (const sp of spheres) s = setImportance(s, sp.id, 1 + (spheres.indexOf(sp) % 5), now);
  return s;
}
const players: Record<string, () => GameState> = {
  'новый демо-игрок': () => initialState(),
  'личный игрок': personal,
  'тяжёлая игра со всеми новыми полями': heavy,
  'старое сохранение без новых полей': () => {
    const s: Record<string, unknown> = { ...heavy() };
    for (const k of ['monthlyReflections', 'moodCheckins', 'sphereImportance', 'monthlyTracking', 'profile', 'mainGoalId'])
      delete s[k];
    return s as unknown as GameState;
  },
};

for (const [name, make] of Object.entries(players)) {
  test(`сохранения: ${name}`, () => {
    const raw = JSON.parse(JSON.stringify(make()));
    // 1. проходит проверку после JSON (как из localStorage и облака)
    validateState(raw);
    const loaded = migrateState(raw);
    // 2. миграция идемпотентна и не теряет данные
    const again = migrateState(JSON.parse(JSON.stringify(loaded)));
    assert.deepEqual(again.events, loaded.events);
    assert.deepEqual(again.quests, loaded.quests);
    assert.deepEqual(again.goals, loaded.goals);
    assert.deepEqual(again.monthlyReflections, loaded.monthlyReflections);
    assert.deepEqual(again.moodCheckins, loaded.moodCheckins);
    assert.deepEqual(again.sphereImportance, loaded.sphereImportance);
    assert.equal(again.xp, loaded.xp);
    // 3. резервная копия возвращает ту же игру
    const restored = restoreBackup(backupText(loaded));
    assert.deepEqual(restored, loaded);
    // 4. облачное разбиение и сборка без потерь, основной документ проходит проверку
    const part = splitForCloud(loaded, now);
    validateState(JSON.parse(JSON.stringify(part.stored)));
    const assembled = assembleFromCloud(
      JSON.parse(JSON.stringify(part.stored)),
      JSON.parse(JSON.stringify(part.history)),
      part.images,
    );
    assert.deepEqual(assembled, loaded);
    // 5. размер основного документа Firestore < 1 МБ с запасом
    assert.ok(JSON.stringify(part.stored).length < 700_000, 'основной документ слишком велик');
    // 6. отчёт месяца считается для любого месяца без ошибок
    for (const month of ['2026-10', '2026-09', '2025-01', '2026-11', '2030-01']) {
      const r = monthReport(loaded, month, now);
      assert.ok(Number.isFinite(r.daysTotal) && r.sphereRows.length === 9);
      assert.ok(r.sphereRows.every((x) => Number.isFinite(x.xp) && Number.isFinite(x.share)));
    }
  });
}

test('повреждённые новые поля отклоняются, игра не меняется', () => {
  const base = JSON.parse(JSON.stringify(heavy()));
  for (const edit of [
    (s: Record<string, any>) => (s.sphereImportance = { quarter: '2026-Q4', values: { health: 9 } }),
    (s: Record<string, any>) => (s.sphereImportance = { quarter: 'x', values: { nope: 3 } }),
    (s: Record<string, any>) => (s.moodCheckins = { '2026-10-01': { mood: 9, energy: 1 } }),
    (s: Record<string, any>) => (s.monthlyReflections['2026-10'].review = { sphereReviews: 'bad' }),
  ]) {
    const s = JSON.parse(JSON.stringify(base));
    edit(s);
    assert.throws(() => validateState(s));
  }
});

test('действия игры не ломают проверку на длинной серии', () => {
  let s = personal();
  for (let i = 0; i < 3; i++) {
    for (const q of s.quests) {
      if (!q.done) s = completeQuest(s, q.id);
      validateState(JSON.parse(JSON.stringify(s)));
    }
  }
  s = addMoodCheckin(s, 9, 9, now);
  s = setImportance(s, 'nope', 3, now);
  s = setImportance(s, 'health', 6, now);
  validateState(JSON.parse(JSON.stringify(s)));
});
