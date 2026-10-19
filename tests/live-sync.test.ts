import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newAccountGame } from '../src/accountGame.ts';
import { AccountSave } from '../src/accountPersistence.ts';
import type { SaveDriver, SaveRow } from '../src/accountPersistence.ts';

class MemoryStorage implements Storage {
  items = new Map<string, string>();
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
/** Общее облако для двух «устройств». */
function sharedCloud() {
  let row: SaveRow | null = null;
  const driver: SaveDriver = {
    async load() {
      return row ? structuredClone(row) : null;
    },
    async create(state) {
      row ??= { state, revision: 1 };
      return structuredClone(row);
    },
    async save(state, revision) {
      if (!row || row.revision !== revision) return null;
      row = { state, revision: row.revision + 1 };
      return structuredClone(row);
    },
  };
  return driver;
}
const factory = () => newAccountGame('Игрок');

test('живое обновление: прогресс с телефона приходит на открытый компьютер без конфликта', async () => {
  const cloud = sharedCloud();
  const phone = new AccountSave('u', cloud, new MemoryStorage(), 'phone');
  const pc = new AccountSave('u', cloud, new MemoryStorage(), 'pc');
  await phone.start(factory);
  await pc.start(factory);
  const before = pc.knownRevision;
  phone.change({ ...phone.current.state!, xp: 120 });
  await phone.flush();
  assert.ok(phone.knownRevision > before);
  // Компьютер ничего не менял: подтягивает чужую версию, а не получает конфликт.
  await pc.refresh();
  assert.equal(pc.current.status, 'saved');
  assert.equal(pc.current.state!.xp, 120);
  assert.equal(pc.knownRevision, phone.knownRevision);
  // Следом компьютер спокойно пишет поверх свежей версии.
  pc.change({ ...pc.current.state!, xp: 150 });
  await pc.flush();
  assert.equal(pc.current.status, 'saved');
  await phone.refresh();
  assert.equal(phone.current.state!.xp, 150);
  phone.dispose();
  pc.dispose();
});

test('живое обновление не затирает несохранённые правки на этом устройстве', async () => {
  const cloud = sharedCloud();
  const phone = new AccountSave('u', cloud, new MemoryStorage(), 'phone');
  const pc = new AccountSave('u', cloud, new MemoryStorage(), 'pc');
  await phone.start(factory);
  await pc.start(factory);
  phone.change({ ...phone.current.state!, xp: 50 });
  await phone.flush();
  pc.change({ ...pc.current.state!, xp: 7 });
  await pc.refresh();
  // Правка ещё не отправлена: обновление пропущено, локальный прогресс на месте.
  assert.equal(pc.current.state!.xp, 7);
  phone.dispose();
  pc.dispose();
});
