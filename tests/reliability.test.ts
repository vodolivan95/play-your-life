import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupText, restoreBackup } from '../src/backup.ts';
import {
  achievements,
  avatars,
  longestStreak,
  clearStorageProblem,
  completeQuest,
  dateKey,
  getRecoveryRaw,
  getStorageProblem,
  initialState,
  loadState,
  questsForToday,
} from '../src/game.ts';

test('копия восстанавливает игру, историю и блокировку повторного XP без подключения TickTick', () => {
  const state = completeQuest(initialState(), 'english-1');
  const restored = restoreBackup(backupText(state));
  assert.deepEqual(restored, state);
  assert.deepEqual(completeQuest(restored, 'english-1'), state);
  assert.equal('connection' in JSON.parse(backupText(state)), false);
  const { profile: _profile, mainGoalId: _goal, ...legacy } = state;
  void _profile;
  void _goal;
  assert.equal(restoreBackup(JSON.stringify(legacy)).xp, state.xp);
});
test('повреждённые копии, неизвестные сферы, дубли ID и числовые поля отклоняются', () => {
  assert.throws(() => restoreBackup('{bad json'));
  assert.throws(() =>
    restoreBackup(
      JSON.stringify({
        app: 'PLAY YOUR LIFE',
        backupVersion: 2,
        state: initialState(),
      }),
    ),
  );
  for (const edit of [
    (s: ReturnType<typeof initialState>) => {
      s.quests[0].sphere = 'unknown';
    },
    (s: ReturnType<typeof initialState>) => {
      s.goals[0].target = 0;
    },
    (s: ReturnType<typeof initialState>) => {
      s.quests.push({ ...s.quests[0] });
    },
    (s: ReturnType<typeof initialState>) => {
      s.spheres.health.score = 10;
    },
    (s: ReturnType<typeof initialState>) => {
      s.quests[0].estimateMinutes = -1;
    },
    (s: ReturnType<typeof initialState>) => {
      s.quests[0].startsAt = 'not-a-date';
    },
  ]) {
    const s = initialState();
    edit(s);
    assert.throws(() => restoreBackup(JSON.stringify(s)));
  }
});
test('нечитаемое сохранение не перезаписывается и остаётся доступным для скачивания', () => {
  const oldDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage',
  );
  let writes = 0;
  const raw = '{broken save';
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => raw,
      setItem: () => {
        writes++;
      },
    },
  });
  try {
    const state = loadState();
    assert.equal(state.profile.onboardingComplete, true);
    assert.ok(getStorageProblem());
    assert.equal(getRecoveryRaw(), raw);
    assert.equal(writes, 0);
  } finally {
    clearStorageProblem();
    if (oldDescriptor)
      Object.defineProperty(globalThis, 'localStorage', oldDescriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
test('Сегодня исключает будущие и вчерашние выполненные задачи, сохраняя просроченные', () => {
  const today = new Date(2026, 9, 3, 12);
  const yesterday = new Date(2026, 9, 2, 12).toISOString();
  const tomorrow = new Date(2026, 9, 4, 12).toISOString();
  const state = initialState();
  state.quests[0] = { ...state.quests[0], done: true, completedAt: yesterday };
  state.quests[1] = {
    ...state.quests[1],
    done: true,
    completedAt: today.toISOString(),
  };
  state.quests[2] = { ...state.quests[2], startsAt: tomorrow };
  state.quests[3] = { ...state.quests[3], dueAt: yesterday };
  assert.deepEqual(
    questsForToday(state, today).map((q) => q.id),
    ['finance-1', 'sport-1'],
  );
  assert.equal(
    questsForToday(state, new Date(2026, 9, 4, 12)).some(
      (q) => q.id === 'sport-1',
    ),
    false,
  );
});
test('старые выполненные задачи используют историю, новые получают дату выполнения', () => {
  const state = completeQuest(initialState(), 'english-1');
  assert.equal(dateKey(new Date(state.quests[0].completedAt!)), dateKey());
  delete state.quests[0].completedAt;
  delete state.events[0].kind;
  assert.ok(questsForToday(state).some((q) => q.id === 'english-1'));
  state.events[0].date = new Date(2025, 0, 1).toISOString();
  assert.equal(
    questsForToday(state).some((q) => q.id === 'english-1'),
    false,
  );
});

test('активные приоритетные и срочные задачи показываются раньше завершённых', () => {
  const s = initialState();
  s.quests[0] = {
    ...s.quests[0],
    done: true,
    completedAt: new Date().toISOString(),
  };
  s.quests[1].priority = 'high';
  s.quests[2].dueAt = new Date(2020, 0, 1).toISOString();
  assert.deepEqual(
    questsForToday(s).map((q) => q.id),
    ['sport-1', 'growth-1', 'finance-1', 'english-1'],
  );
});

test('достижения серии и личного стандарта сохраняются после пропуска и снижения оценки', () => {
  const state = initialState();
  state.activeDates = ['2020-01-03', '2020-01-01', '2020-01-02', '2020-01-02'];
  assert.equal(longestStreak(state.activeDates), 3);
  const rhythm = achievements.find((a) => a.name === 'В ритме')!;
  assert.equal(rhythm.unlocked(state), true);
  assert.equal(rhythm.progress(state), 1);
  state.spheres.health.highScore = 9;
  state.spheres.health.score = 4;
  assert.equal(
    achievements.find((a) => a.name === 'Личный стандарт')!.unlocked(state),
    true,
  );
});
test('лучшая серия учитывает границу года и не использует будущие дни', () => {
  assert.equal(
    longestStreak(
      ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'],
      new Date(2026, 0, 1, 12),
    ),
    3,
  );
  assert.equal(
    longestStreak(
      ['2026-01-01', '2026-01-03', '2026-01-04'],
      new Date(2026, 0, 5, 12),
    ),
    2,
  );
});

test('копия не сбрасывает личный режим из-за невалидного профиля и поддерживает все аватары', () => {
  const s = initialState();
  s.profile.mode = 'personal';
  s.profile.name = 'Иван';
  for (const avatar of avatars) {
    s.profile.avatar = avatar.icon;
    assert.equal(restoreBackup(backupText(s)).profile.mode, 'personal');
  }
  s.profile.avatar = 'unsupported';
  assert.throws(() => restoreBackup(backupText(s)));
  s.profile.avatar = 'character';
  s.profile.name = '   ';
  assert.throws(() => restoreBackup(backupText(s)));
});
