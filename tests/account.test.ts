import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newAccountGame } from '../src/accountGame.ts';
import { AccountSave } from '../src/accountPersistence.ts';
import type { SaveDriver, SaveRow } from '../src/accountPersistence.ts';
import { playerProgress, spheres } from '../src/game.ts';
import type { GameState } from '../src/game.ts';
import { restoreBackup, stateStorageKey } from '../src/backup.ts';
class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  key(i: number) {
    return [...this.items.keys()][i] ?? null;
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  clear() {
    this.items.clear();
  }
}
function driver(initial: SaveRow | null = null) {
  let row = initial;
  let offline = false;
  const api: SaveDriver = {
    async load() {
      if (offline) throw Error('offline');
      return row;
    },
    async create(state) {
      if (offline) throw Error('offline');
      row ??= { state, revision: 1 };
      return row;
    },
    async save(state, revision) {
      if (offline) throw Error('offline');
      if (!row || row.revision !== revision) return null;
      row = { state, revision: revision + 1 };
      return row;
    },
  };
  return {
    api,
    get row() {
      return row;
    },
    replace(next: SaveRow) {
      row = next;
    },
    offline(value: boolean) {
      offline = value;
    },
  };
}
const factory = () => newAccountGame('Игрок');
test('новый аккаунт: 0 XP и монет, все 9 сфер нулевые, нет демо-проектов', () => {
  const state = factory();
  assert.equal(state.xp, 0);
  assert.equal(state.coins, 0);
  assert.equal(playerProgress(state).level, 1);
  assert.equal(state.completed, 0);
  assert.deepEqual(state.goals, []);
  assert.deepEqual(state.quests, []);
  assert.deepEqual(state.events, []);
  for (const sphere of spheres) assert.equal(state.spheres[sphere.id].xp, 0);
  assert.equal(restoreBackup(JSON.stringify(state)).profile.mode, 'personal');
});
test('новый пользователь не наследует сохранения другого аккаунта или гостя', async () => {
  const storage = new MemoryStorage(),
    first = driver(),
    second = driver();
  storage.setItem(stateStorageKey, JSON.stringify({ ...factory(), xp: 999 }));
  const a = new AccountSave('a', first.api, storage, 'a');
  await a.start(factory);
  a.change({ ...a.current.state!, xp: 35 });
  await a.flush();
  a.dispose();
  const b = new AccountSave('b', second.api, storage, 'b');
  await b.start(factory);
  assert.equal(b.current.state!.xp, 0);
  b.dispose();
  const again = new AccountSave('a', first.api, storage, 'again');
  await again.start(factory);
  assert.equal(again.current.state!.xp, 35);
  again.dispose();
});
test('перезагрузка после офлайн-изменений отправляет сохранённый прогресс', async () => {
  const storage = new MemoryStorage(),
    cloud = driver(),
    a = new AccountSave('a', cloud.api, storage, 'tab1');
  await a.start(factory);
  cloud.offline(true);
  a.change({ ...a.current.state!, xp: 20, coins: 5 });
  await a.flush();
  assert.equal(a.current.status, 'offline');
  a.dispose();
  const b = new AccountSave('a', cloud.api, storage, 'tab2');
  await b.start(factory);
  assert.equal(b.current.state!.xp, 20);
  cloud.offline(false);
  await b.flush();
  assert.equal(cloud.row!.state.xp, 20);
  assert.equal(b.current.status, 'saved');
  b.dispose();
});
test('без сети и локальной копии существующая игра не заменяется пустой', async () => {
  const cloud = driver({ state: { ...factory(), xp: 150 }, revision: 9 });
  cloud.offline(true);
  const a = new AccountSave('a', cloud.api, new MemoryStorage(), 'tab');
  await a.start(factory);
  assert.equal(a.current.state, null);
  assert.equal(a.current.status, 'error');
  assert.equal(cloud.row!.state.xp, 150);
  a.dispose();
});
test('конфликт устройств сохраняет обе игры и требует явного выбора', async () => {
  const cloud = driver(),
    a = new AccountSave('a', cloud.api, new MemoryStorage(), 'tab');
  await a.start(factory);
  a.change({ ...a.current.state!, xp: 20 });
  cloud.replace({ state: { ...factory(), xp: 50 }, revision: 2 });
  await a.flush();
  assert.equal(a.current.status, 'conflict');
  assert.equal(a.current.state!.xp, 20);
  assert.equal(a.current.remote!.state.xp, 50);
  a.change({ ...factory(), xp: 999 });
  assert.equal(a.current.state!.xp, 20);
  await a.chooseLocal();
  assert.equal(cloud.row!.state.xp, 20);
  assert.equal(cloud.row!.revision, 3);
  a.dispose();
});
test('принятие облачной версии оставляет резервную копию местных изменений', async () => {
  const storage = new MemoryStorage(),
    cloud = driver(),
    a = new AccountSave('a', cloud.api, storage, 'tab');
  await a.start(factory);
  a.change({ ...a.current.state!, xp: 20 });
  cloud.replace({ state: { ...factory(), xp: 90 }, revision: 2 });
  await a.flush();
  await a.chooseRemote();
  assert.equal(a.current.state!.xp, 90);
  assert.ok(
    [...Array(storage.length)].some((_, i) =>
      storage.key(i)!.includes(':recovery:'),
    ),
  );
  a.dispose();
});
test('изменение во время отправки не теряется после ответа сервера', async () => {
  const cloud = driver();
  let release!: () => void;
  let started!: () => void;
  const begun = new Promise<void>((resolve) => {
    started = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first = true;
  const api: SaveDriver = {
    ...cloud.api,
    async save(state: GameState, revision: number) {
      if (first) {
        first = false;
        started();
        await gate;
      }
      return cloud.api.save(state, revision);
    },
  };
  const a = new AccountSave('a', api, new MemoryStorage(), 'tab');
  await a.start(factory);
  a.change({ ...factory(), xp: 20 });
  const saving = a.flush();
  await begun;
  a.change({ ...factory(), xp: 55 });
  release();
  await saving;
  assert.equal(cloud.row!.state.xp, 55);
  assert.equal(cloud.row!.revision, 3);
  a.dispose();
});
test('завершившийся запрос старого аккаунта не обновляет отключённую игру', async () => {
  let release!: (row: SaveRow) => void;
  const pending = new Promise<SaveRow>((resolve) => {
    release = resolve;
  });
  const cloud = driver();
  const a = new AccountSave(
    'a',
    { ...cloud.api, load: () => pending },
    new MemoryStorage(),
    'tab',
  );
  let notifications = 0;
  a.subscribe(() => notifications++);
  const starting = a.start(factory);
  a.dispose();
  release({ state: { ...factory(), xp: 100 }, revision: 4 });
  await starting;
  assert.equal(notifications, 0);
  assert.equal(a.current.state, null);
});
