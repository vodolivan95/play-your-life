import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { newAccountGame } from '../src/accountGame.ts';
import { AccountSave } from '../src/accountPersistence.ts';
import type { SaveDriver, SaveProgress, SaveRow } from '../src/accountPersistence.ts';
import type { GameState } from '../src/game.ts';

class MemoryStorage implements Storage {
  items = new Map<string, string>();
  limit = Infinity;
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
    const used = [...this.items].reduce(
      (sum, [k, v]) => (k === key ? sum : sum + k.length + v.length),
      0,
    );
    if (used + key.length + value.length > this.limit)
      throw new Error('QuotaExceededError');
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  clear() {
    this.items.clear();
  }
  keys(part: string) {
    return [...this.items.keys()].filter((key) => key.includes(part));
  }
}
const factory = () => newAccountGame('Игрок');
/**
 * Облачная версия, которую структурное автослияние (`src/stateMerge.ts`) не сможет
 * принять: независимо от xp здесь портится сфера «health» (highScore меньше score),
 * что отклонит `validateState()` после слияния. Так тесты ниже проверяют настоящий,
 * неразрешимый автоматически конфликт, а не просто расхождение xp (которое теперь
 * сливается само по себе — см. `tests/account.test.ts`).
 */
function unmergeable(state: GameState): GameState {
  return {
    ...state,
    spheres: { ...state.spheres, health: { xp: 0, score: 5, highScore: 3, previousScore: 0 } },
  };
}
/** Облако, в котором можно заранее назначить сбои конкретных вызовов. */
function cloud(initial: SaveRow | null = null) {
  let row = initial;
  const plan = {
    /** Сколько ближайших записей применить, но «потерять» ответ. */
    lostAnswers: 0,
    /** Сколько ближайших записей оборвать до применения. */
    drops: 0,
    /** Сколько коммитов делать за одну запись и после какого оборвать связь (0 — не обрывать). */
    steps: 1,
    cutAfterStep: 0,
  };
  const log = { writes: 0, loads: 0 };
  const api: SaveDriver = {
    async load() {
      log.loads++;
      return row ? structuredClone(row) : null;
    },
    async create(state) {
      row ??= { state, revision: 1 };
      return structuredClone(row);
    },
    async save(state, revision, progress?: SaveProgress) {
      if (plan.drops > 0) {
        plan.drops--;
        throw new Error('offline');
      }
      if (!row || row.revision !== revision) return null;
      for (let step = 1; step <= plan.steps; step++) {
        const staged: GameState = { ...state, coins: state.coins + (plan.steps - step) };
        if (progress?.({ state: staged, revision: row.revision + 1 }, false) === false)
          throw new Error('stopped');
        row = { state: staged, revision: row.revision + 1 };
        log.writes++;
        if (plan.cutAfterStep === step) {
          plan.cutAfterStep = 0;
          throw new Error('offline');
        }
        // Ответ последнего коммита потерялся: запись применена, подтверждения нет.
        if (step === plan.steps && plan.lostAnswers > 0) {
          plan.lostAnswers--;
          throw new Error('answer lost');
        }
        progress?.({ state: staged, revision: row.revision }, true);
      }
      return structuredClone(row);
    },
  };
  return {
    api,
    plan,
    log,
    get row() {
      return row;
    },
    replace(next: SaveRow) {
      row = next;
    },
  };
}
async function open(c: ReturnType<typeof cloud>, storage: Storage, writer: string) {
  const engine = new AccountSave('a', c.api, storage, writer);
  await engine.start(factory);
  return engine;
}

test('ответ сервера потерялся: повтор не даёт ложного конфликта и не пишет лишнего', async () => {
  const c = cloud(),
    storage = new MemoryStorage(),
    a = await open(c, storage, 'tab');
  a.change({ ...a.current.state!, xp: 40 });
  c.plan.lostAnswers = 1;
  await a.flush();
  assert.equal(a.current.status, 'offline');
  assert.equal(c.row!.state.xp, 40, 'запись дошла');
  const writes = c.log.writes;
  await a.flush();
  assert.equal(a.current.status, 'saved');
  assert.equal(c.log.writes, writes, 'повторной записи не было');
  assert.deepEqual(storage.keys(':draft:'), []);
  a.dispose();
});

test('потерянный ответ и закрытая страница: новая сессия продолжает без конфликта', async () => {
  const c = cloud(),
    storage = new MemoryStorage(),
    a = await open(c, storage, 'tab1');
  a.change({ ...a.current.state!, xp: 25 });
  c.plan.lostAnswers = 1;
  await a.flush();
  a.dispose();
  const b = await open(c, storage, 'tab2');
  assert.notEqual(b.current.status, 'conflict');
  await b.flush();
  assert.equal(b.current.status, 'saved');
  assert.equal(b.current.state!.xp, 25);
  assert.deepEqual(storage.keys(':draft:'), []);
  b.dispose();
});

test('запись из нескольких коммитов оборвалась посередине: продолжается без конфликта', async () => {
  const c = cloud(),
    storage = new MemoryStorage(),
    a = await open(c, storage, 'tab');
  c.plan.steps = 3;
  c.plan.cutAfterStep = 2;
  a.change({ ...a.current.state!, xp: 70, coins: 4 });
  await a.flush();
  assert.equal(a.current.status, 'offline');
  assert.equal(c.row!.revision, 3, 'облако продвинулось на два коммита');
  await a.flush();
  assert.equal(a.current.status, 'saved');
  assert.equal(c.row!.state.xp, 70);
  assert.equal(c.row!.state.coins, 4);
  a.dispose();
});

test('страницу закрыли посреди многошаговой записи: следующий запуск доводит её до конца', async () => {
  const c = cloud(),
    storage = new MemoryStorage(),
    a = await open(c, storage, 'tab1');
  c.plan.steps = 3;
  c.plan.cutAfterStep = 1;
  a.change({ ...a.current.state!, xp: 90, coins: 2 });
  await a.flush();
  a.dispose();
  const b = await open(c, storage, 'tab2');
  assert.notEqual(b.current.status, 'conflict', 'облако продвинулось нашей же записью');
  await b.flush();
  assert.equal(b.current.status, 'saved');
  assert.equal(c.row!.state.xp, 90);
  b.dispose();
});

test('после закрытия игры следующие коммиты не отправляются', async () => {
  const c = cloud(),
    a = await open(c, new MemoryStorage(), 'tab');
  c.plan.steps = 3;
  const original = c.api.save.bind(c.api);
  c.api.save = async (state, revision, progress) =>
    original(state, revision, (row, committed) => {
      const answer = progress?.(row, committed);
      if (committed && row.revision === 2) a.dispose();
      return answer;
    });
  a.change({ ...a.current.state!, xp: 12 });
  await a.flush().catch(() => undefined);
  assert.equal(c.row!.revision, 2, 'после закрытия записано не более одного коммита');
});

test('черновик, который остался после успешной отправки, не вызывает конфликт', async () => {
  const c = cloud(),
    storage = new MemoryStorage(),
    a = await open(c, storage, 'tab1');
  a.change({ ...a.current.state!, xp: 33 });
  const stale = [...storage.items].find(([key]) => key.includes(':draft:'))!;
  await a.flush();
  a.dispose();
  // Страницу закрыли до удаления черновика: он остался с прежним номером версии.
  storage.items.set(stale[0], stale[1]);
  const b = await open(c, storage, 'tab2');
  assert.equal(b.current.status, 'saved');
  assert.equal(b.current.state!.xp, 33);
  assert.deepEqual(storage.keys(':draft:'), []);
  b.dispose();
});

test('старый черновик другой вкладки не теряется: уходит в страховочную копию', async () => {
  const c = cloud(),
    storage = new MemoryStorage(),
    a = await open(c, storage, 'tab1');
  a.change({ ...a.current.state!, xp: 11 });
  c.plan.drops = 1;
  await a.flush();
  a.dispose();
  c.plan.drops = 2;
  const b = await open(c, storage, 'tab2');
  await b.flush();
  assert.equal(b.current.status, 'offline');
  b.change({ ...b.current.state!, xp: 22 });
  b.dispose();
  const third = await open(c, storage, 'tab3');
  assert.equal(third.current.state!.xp, 22, 'открыт самый новый черновик');
  await third.flush();
  assert.equal(c.row!.state.xp, 22);
  assert.deepEqual(storage.keys(':draft:'), [], 'зависших черновиков нет');
  const retired = storage.keys(':retired:');
  assert.equal(retired.length, 1, 'старая правка сохранена отдельной копией');
  assert.equal(JSON.parse(storage.getItem(retired[0])!).xp, 11);
  third.dispose();
});

test('страховочных копий хранится не больше трёх', async () => {
  const c = cloud(),
    storage = new MemoryStorage(),
    a = await open(c, storage, 'tab');
  for (let i = 1; i <= 6; i++) {
    a.change({ ...a.current.state!, xp: i });
    c.replace({
      state: unmergeable({ ...factory(), xp: 100 + i }),
      revision: (c.row?.revision ?? 0) + 1,
    });
    await a.flush();
    assert.equal(a.current.status, 'conflict');
    await a.chooseRemote(true);
  }
  assert.equal(storage.keys(':recovery:').length, 3);
  a.dispose();
});

test('выбор версии устройства оставляет копию заменяемой облачной версии', async () => {
  const c = cloud(),
    storage = new MemoryStorage(),
    a = await open(c, storage, 'tab');
  a.change({ ...a.current.state!, xp: 20 });
  c.replace({ state: unmergeable({ ...factory(), xp: 500 }), revision: 2 });
  await a.flush();
  assert.equal(a.current.status, 'conflict');
  await a.chooseLocal();
  assert.equal(c.row!.state.xp, 20);
  const copies = storage.keys(':recovery:');
  assert.equal(copies.length, 1);
  assert.equal(JSON.parse(storage.getItem(copies[0])!).xp, 500);
  a.dispose();
});

test('чужая запись с другим содержимым по-прежнему даёт конфликт, а не перезапись', async () => {
  const c = cloud(),
    storage = new MemoryStorage(),
    a = await open(c, storage, 'tab');
  a.change({ ...a.current.state!, xp: 8 });
  c.replace({ state: unmergeable({ ...factory(), xp: 700 }), revision: 2 });
  await a.flush();
  assert.equal(a.current.status, 'conflict');
  assert.equal(c.row!.state.xp, 700);
  a.dispose();
  const b = await open(c, storage, 'tab2');
  assert.equal(b.current.status, 'conflict', 'конфликт виден и после перезапуска');
  assert.equal(b.current.state!.xp, 8);
  assert.equal(b.current.remote!.state.xp, 700);
  b.dispose();
});

test('нет места в хранилище: черновик пишется, освобождая копию облака', async () => {
  const c = cloud(),
    storage = new MemoryStorage(),
    a = await open(c, storage, 'tab');
  const size = JSON.stringify(a.current.state).length;
  storage.limit = size * 2 + 700;
  a.change({ ...a.current.state!, xp: 5 });
  assert.equal(a.current.localSaved, true);
  assert.equal(storage.keys(':draft:').length, 1);
  a.dispose();
});

test('непрерывные правки отправляются не позже чем через 5 секунд', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_700_000_000_000 });
  try {
    const c = cloud(),
      a = await open(c, new MemoryStorage(), 'tab');
    for (let t = 0; t < 4500; t += 400) {
      a.change({ ...a.current.state!, xp: t + 1 });
      mock.timers.tick(400);
    }
    assert.equal(c.log.writes, 0, 'пока идёт непрерывный набор, пауза продлевается');
    a.change({ ...a.current.state!, xp: 9999 });
    mock.timers.tick(700);
    for (let i = 0; i < 20; i++) await Promise.resolve();
    assert.equal(c.row!.state.xp, 9999);
    a.dispose();
  } finally {
    mock.timers.reset();
  }
});

test('pending показывает неотправленные изменения', async () => {
  const c = cloud(),
    a = await open(c, new MemoryStorage(), 'tab');
  assert.equal(a.pending, false);
  a.change({ ...a.current.state!, xp: 3 });
  assert.equal(a.pending, true);
  await a.flush();
  assert.equal(a.pending, false);
  a.dispose();
  assert.equal(a.pending, false);
});
