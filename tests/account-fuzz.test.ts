import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newAccountGame } from '../src/accountGame.ts';
import { AccountSave } from '../src/accountPersistence.ts';
import type { SaveDriver, SaveRow } from '../src/accountPersistence.ts';
import type { GameState } from '../src/game.ts';

/**
 * Случайные сценарии для облачного сохранения: обрывы сети до и после записи,
 * потерянные ответы, запись из нескольких коммитов, перезапуски страницы,
 * записи с другого устройства и сбои localStorage. Каждый сценарий воспроизводится по номеру.
 *
 * Объём: FUZZ_SCENARIOS (по умолчанию 500 на каждый вид сценариев).
 */
const SCENARIOS = Number(process.env.FUZZ_SCENARIOS) || 500;

type Rng = () => number;
function random(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  private rng: Rng;
  private failRate: number;
  constructor(rng: Rng = () => 1, failRate = 0) {
    this.rng = rng;
    this.failRate = failRate;
  }
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
    if (this.failRate && this.rng() < this.failRate)
      throw new Error('QuotaExceededError');
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  clear() {
    this.items.clear();
  }
  keys(prefix: string) {
    return [...this.items.keys()].filter((key) => key.includes(prefix));
  }
}
const tick = async (rng: Rng) => {
  for (let i = Math.floor(rng() * 3); i >= 0; i--) await Promise.resolve();
};
const FOREIGN = 'F';
/** Облако с отказами. Хранит «как в Firestore»: версия растёт на 1 с каждым коммитом. */
class FakeCloud {
  row: SaveRow | null = null;
  online = true;
  lossBefore = 0;
  lossAfter = 0;
  foreign = 0;
  overwrites = 0;
  /** Версии до этой пользователь разрешил заменить, выбрав «сохранить версию устройства». */
  allowUpTo = -1;
  /** Простой драйвер: один коммит, без сообщений о шагах и без своего приведения игры. */
  simple = false;
  log: (message: string) => void = () => {};
  private rng: Rng;
  constructor(rng: Rng) {
    this.rng = rng;
  }
  /** Облако сохраняет игру в приведённом виде, не совпадающем с экранной. */
  final(state: GameState): GameState {
    if (this.simple) return state;
    return { ...state, profile: { ...state.profile, onboardingComplete: true } };
  }
  private write(state: GameState) {
    const previous = this.row;
    if (
      previous?.state.profile.name.startsWith(FOREIGN) &&
      !state.profile.name.startsWith(FOREIGN) &&
      previous.revision > this.allowUpTo
    )
      this.overwrites++;
    this.row = { state, revision: (previous?.revision ?? 0) + 1 };
    this.log(`[v${this.row.revision} xp=${state.xp} c=${state.coins}]`);
  }
  writeForeign() {
    if (!this.row) return;
    this.foreign++;
    const state = this.row.state;
    this.write({
      ...state,
      xp: 10000 + this.foreign,
      profile: { ...state.profile, name: `${FOREIGN}${this.foreign}` },
    });
  }
  private gate(loss: number) {
    if (!this.online || this.rng() < loss) {
      this.log('(обрыв)');
      throw new Error('offline');
    }
  }
  private copy() {
    return structuredClone(this.row!);
  }
  api: SaveDriver = {
    load: async () => {
      await tick(this.rng);
      this.gate(this.lossBefore);
      return this.row ? this.copy() : null;
    },
    create: async (state) => {
      await tick(this.rng);
      this.gate(this.lossBefore);
      if (!this.row) this.write(this.final(structuredClone(state)));
      return this.copy();
    },
    save: async (state, revision, progress) => {
      await tick(this.rng);
      this.gate(this.lossBefore);
      if (!this.row || this.row.revision !== revision) return null;
      const target = this.final(structuredClone(state));
      const steps = this.simple ? 1 : 1 + Math.floor(this.rng() * 3);
      for (let step = 1; step <= steps; step++) {
        const staged: GameState = {
          ...target,
          coins: target.coins + (steps - step),
        };
        if (
          !this.simple &&
          progress?.({ state: staged, revision: this.row!.revision + 1 }, false) === false
        )
          throw new Error('cancelled');
        await tick(this.rng);
        if (!this.online || this.rng() < this.lossBefore) {
          this.log('(обрыв до коммита)');
          throw new Error('offline');
        }
        if (this.row!.revision !== revision + step - 1) return null;
        this.write(staged);
        if (!this.online || this.rng() < this.lossAfter) {
          this.log('(ответ потерян)');
          throw new Error('response lost');
        }
        if (!this.simple) progress?.({ state: staged, revision: this.row!.revision }, true);
      }
      return this.copy();
    },
  };
}
type Mode = 'single' | 'foreign' | 'storage';
async function scenario(seed: number, mode: Mode) {
  const rng = random(seed * 7919 + (mode === 'single' ? 1 : mode === 'foreign' ? 2 : 3));
  const cloud = new FakeCloud(rng);
  cloud.simple = rng() < 0.3;
  const storage = new MemoryStorage(rng, mode === 'storage' ? 0.2 : 0);
  const trace: string[] = [];
  if (process.env.FUZZ_LOG) cloud.log = (message) => trace.push(message);
  let writers = 0;
  let counter = 0;
  let conflictSeen = false;
  let engine: AccountSave;
  const factory = () => newAccountGame('Игрок');
  const boot = async () => {
    engine?.dispose();
    engine = new AccountSave('u1', cloud.api, storage, `w${++writers}`);
    const id = writers;
    if (process.env.FUZZ_LOG) trace.push(`<движок ${id}>`);
    engine.subscribe((snapshot) => {
      if (process.env.FUZZ_LOG) trace.push(`{${id}:${snapshot.status} xp=${snapshot.state?.xp}}`);
      if (snapshot.status === 'conflict' && !conflictSeen) {
        conflictSeen = true;
        trace.push(`КОНФЛИКТ(облако v${snapshot.remote?.revision} xp=${snapshot.remote?.state.xp}; экран xp=${snapshot.state?.xp})`);
      }
    });
    await engine.start(factory);
  };
  const fail = (message: string) =>
    assert.fail(
      `${mode} #${seed}: ${message}\nшаги: ${trace.join(' → ')}\nоблако: xp=${cloud.row?.state.xp} v${cloud.row?.revision}; экран: xp=${engine.current.state?.xp} ${engine.current.status}`,
    );
  const edit = () => {
    const state = engine.current.state;
    if (!state || engine.current.status === 'conflict') return false;
    counter++;
    engine.change({ ...state, xp: counter, coins: counter % 5 });
    return true;
  };
  const resolve = async () => {
    if (engine.current.status !== 'conflict') return;
    if (rng() < 0.5) {
      trace.push('remote');
      await engine.chooseRemote(true);
      counter = engine.current.state!.xp;
    } else {
      trace.push('local');
      cloud.allowUpTo = Math.max(cloud.allowUpTo, engine.current.remote?.revision ?? -1);
      await engine.chooseLocal();
    }
  };
  await boot();
  if (!engine!.current.state) await boot();
  for (let i = 0, n = 15 + Math.floor(rng() * 30); i < n; i++) {
    const roll = rng();
    if (roll < 0.34) trace.push(edit() ? `e${counter}` : 'e-');
    else if (roll < 0.48) {
      trace.push('flush');
      await engine!.flush();
    } else if (roll < 0.58) {
      trace.push('e+flush');
      const saving = engine!.flush();
      await tick(rng);
      edit();
      await saving;
    } else if (roll < 0.7) {
      cloud.online = rng() > 0.3;
      cloud.lossBefore = rng() < 0.5 ? 0 : 0.35;
      cloud.lossAfter = rng() < 0.5 ? 0 : 0.35;
      trace.push(`net${cloud.online ? '+' : '-'}${cloud.lossBefore}/${cloud.lossAfter}`);
    } else if (roll < 0.82) {
      trace.push('restart');
      await boot();
    } else if (roll < 0.87) {
      trace.push('refresh');
      await engine!.refresh();
    } else if (mode === 'foreign' && roll < 0.95) {
      trace.push('foreign');
      cloud.writeForeign();
    } else if (mode === 'foreign') await resolve();
    else trace.push('idle');
  }
  // Связь вернулась.
  cloud.online = true;
  cloud.lossBefore = 0;
  cloud.lossAfter = 0;
  trace.push('heal');
  const settle = async () => {
    for (let i = 0; i < 8; i++) {
      if (!engine.current.state) await boot();
      await engine.flush();
      await resolveIfNeeded();
      if (engine.current.status === 'saved' && !engine.pending) return;
    }
  };
  const resolveIfNeeded = async () => {
    if (mode !== 'single') await resolve();
  };
  await settle();
  // Страницу закрыли и открыли снова: ничего не должно потеряться и не должно появиться ложных конфликтов.
  trace.push('final-restart');
  await boot();
  await settle();
  const state = engine!.current.state;
  if (!state) return fail('игра не загрузилась после восстановления связи');
  if (cloud.overwrites) fail('чужая запись перезаписана без выбора пользователя');
  if (engine!.current.status === 'conflict')
    fail('конфликт остался после разрешения');
  if (mode === 'single' && conflictSeen)
    fail('ложный конфликт: других устройств в сценарии нет');
  if (engine!.current.status !== 'saved') fail(`итоговый статус ${engine!.current.status}`);
  if (mode !== 'storage') {
    // Облако и экран совпадают, последняя правка не потеряна.
    assert.equal(cloud.row!.state.xp, state.xp, `${mode} #${seed}: облако и экран расходятся\n${trace.join(' → ')}`);
    assert.equal(cloud.row!.state.coins, state.coins);
    if (mode === 'single')
      assert.equal(state.xp, counter, `${mode} #${seed}: последняя правка потеряна\n${trace.join(' → ')}`);
    assert.deepEqual(
      storage.keys(':draft:'),
      [],
      `${mode} #${seed}: остался черновик\n${trace.join(' → ')}`,
    );
    for (const kind of [':recovery:', ':retired:'])
      assert.ok(storage.keys(kind).length <= 3, `копий ${kind} больше трёх`);
  } else if (cloud.row!.state.xp !== state.xp) {
    // Без localStorage облако всё равно получает последнюю правку, пока страница жива.
    fail('облако и экран расходятся при сбоях хранилища');
  }
  engine!.dispose();
}
for (const mode of ['single', 'foreign', 'storage'] as const)
  test(`случайные сценарии сохранения: ${mode} (${SCENARIOS})`, async () => {
    const only = process.env.FUZZ_ONLY?.split(':');
    if (only && only[0] !== mode) return;
    for (let seed = only ? Number(only[1]) : 1; seed <= (only ? Number(only[1]) : SCENARIOS); seed++)
      await scenario(seed, mode);
  });
