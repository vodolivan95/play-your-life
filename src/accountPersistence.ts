import type { GameState } from './game.ts';
import { restoreBackup } from './backup.ts';
import { saveError } from './saveError.ts';
import { fingerprint } from './stateFingerprint.ts';
import { mergeStates } from './stateMerge.ts';
import { validateState } from './stateValidation.ts';
export type SaveRow = { state: GameState; revision: number };
/**
 * Запись в облако может состоять из нескольких коммитов. Драйвер сообщает о каждом:
 * `committed = false` — сразу перед отправкой (версия, которая может оказаться в облаке,
 * даже если ответ потеряется), `committed = true` — после подтверждения.
 * Ответ `false` перед отправкой означает «хватит»: игру закрыли, следующий шаг не отправляется.
 */
export type SaveProgress = (row: SaveRow, committed: boolean) => boolean | void;
export interface SaveDriver {
  load(): Promise<SaveRow | null>;
  create(state: GameState): Promise<SaveRow>;
  save(
    state: GameState,
    revision: number,
    progress?: SaveProgress,
  ): Promise<SaveRow | null>;
}
export type SaveStatus =
  | 'loading'
  | 'saved'
  | 'pending'
  | 'saving'
  | 'offline'
  | 'conflict'
  | 'error';
export type SaveSnapshot = {
  state: GameState | null;
  status: SaveStatus;
  message: string;
  remote: SaveRow | null;
  localSaved: boolean;
};
/** Пауза после последней правки перед отправкой. */
const DEBOUNCE_MS = 650;
/** Как долго можно откладывать отправку при непрерывных правках. */
const MAX_WAIT_MS = 5000;
/** Сколько отпечатков «наших» версий хранить в черновике. */
const SENT_LIMIT = 24;
/** Сколько раз подряд можно пересесть на новую версию облака, если там лежит наша же запись. */
const REBASE_LIMIT = 3;
/** Сколько раз подряд можно попытаться автоматически слить правки с другим устройством. */
const MERGE_LIMIT = 3;
/** Сколько страховочных копий каждого вида оставлять. */
const RECOVERY_KEEP = 3;
const SAVED_TEXT = 'Прогресс сохранён в аккаунте';
type Draft = SaveRow & {
  userId: string;
  savedAt: number;
  sent: number[];
  /** Версия, от которой начались эти правки — нужна для автослияния при восстановлении черновика. */
  base?: GameState;
};
type DraftCopy = { draft: Draft; key: string; raw: string };
type RecoveryKind = 'recovery' | 'retired';
/**
 * Отпечатки версии: как есть и в виде, в котором её вернёт облако
 * (облако чинит и дополняет игру при чтении, поэтому видимая версия может отличаться).
 */
function marks(state: GameState): number[] {
  const own = fingerprint(state);
  try {
    const stored = fingerprint(restoreBackup(JSON.stringify(state)));
    return stored === own ? [own] : [own, stored];
  } catch {
    return [own];
  }
}
export class AccountSave {
  private driver: SaveDriver;
  private storage: Storage;
  private userId: string;
  private cacheKey: string;
  private draftKey: string;
  /** Черновики, найденные при запуске: самый новый первым. После сохранения они убираются. */
  private copies: DraftCopy[] = [];
  private revision = 0;
  /** Версия, подтверждённая облаком последней — опорная точка для автослияния при конфликте. */
  private base: GameState | null = null;
  /** Отпечатки версий, про которые известно, что их записали мы (или они были в облаке до наших правок). */
  private sent: number[] = [];
  private dirty = false;
  private edit = 0;
  private firstDirtyAt = 0;
  private copyCounter = 0;
  /** Часы черновиков: только растут, даже если системное время сдвинули назад или две правки в одну миллисекунду. */
  private clock = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private active = true;
  private inFlight: Promise<void> | null = null;
  private snapshot: SaveSnapshot = {
    state: null,
    status: 'loading',
    message: '',
    remote: null,
    localSaved: true,
  };
  private listeners = new Set<(snapshot: SaveSnapshot) => void>();
  constructor(
    userId: string,
    driver: SaveDriver,
    storage: Storage,
    writerId = crypto.randomUUID(),
  ) {
    this.userId = userId;
    this.driver = driver;
    this.storage = storage;
    this.cacheKey = `play-your-life-account:${userId}:cache`;
    this.draftKey = `play-your-life-account:${userId}:draft:${writerId}`;
  }
  get current() {
    return this.snapshot;
  }
  /** Номер облачной версии, которую движок считает последней известной. */
  get knownRevision() {
    return this.revision;
  }
  /** Есть изменения, которые ещё не подтверждены облаком. */
  get pending() {
    return (
      this.active &&
      this.snapshot.status !== 'conflict' &&
      (this.dirty || this.inFlight !== null)
    );
  }
  subscribe(listener: (snapshot: SaveSnapshot) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(patch: Partial<SaveSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    if (this.active) this.listeners.forEach((l) => l(this.snapshot));
  }
  private decode(raw: string | null): Draft | null {
    try {
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (
        d.userId !== this.userId ||
        !Number.isInteger(d.revision) ||
        d.revision < 1 ||
        !Number.isFinite(d.savedAt)
      )
        return null;
      const state = restoreBackup(JSON.stringify(d.state));
      if (state.profile.mode !== 'personal') return null;
      const sent: number[] = Array.isArray(d.sent)
        ? d.sent.filter((n: unknown) => typeof n === 'number' && Number.isFinite(n))
        : [];
      let base: GameState | undefined;
      if (d.base !== undefined) {
        try {
          const b = restoreBackup(JSON.stringify(d.base));
          if (b.profile.mode === 'personal') base = b;
        } catch {
          /* Без базы автослияние при восстановлении этого черновика просто не сработает. */
        }
      }
      return {
        userId: this.userId,
        state,
        revision: d.revision,
        savedAt: d.savedAt,
        sent: sent.slice(-SENT_LIMIT),
        base,
      };
    } catch {
      return null;
    }
  }
  private readCache() {
    try {
      return this.decode(this.storage.getItem(this.cacheKey));
    } catch {
      return null;
    }
  }
  /** Все читаемые черновики этого пользователя, самый новый первым. */
  private readDrafts(): DraftCopy[] {
    const copies: DraftCopy[] = [];
    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (!key?.startsWith(`play-your-life-account:${this.userId}:draft:`))
          continue;
        const raw = this.storage.getItem(key),
          draft = this.decode(raw);
        if (draft && raw) copies.push({ draft, key, raw });
      }
    } catch {
      /* Cloud data remains available without local storage. */
    }
    return copies.sort((a, b) => b.draft.savedAt - a.draft.savedAt);
  }
  private persistDraft() {
    if (!this.snapshot.state) return;
    this.clock = Math.max(this.clock + 1, Date.now());
    const text = JSON.stringify({
      userId: this.userId,
      revision: this.revision,
      state: this.snapshot.state,
      savedAt: this.clock,
      sent: this.sent,
      base: this.base ?? undefined,
    });
    try {
      this.storage.setItem(this.draftKey, text);
      this.emit({ localSaved: true });
      return;
    } catch {
      /* Не хватило места: копия последнего облачного состояния менее ценна, чем неотправленные правки. */
    }
    try {
      this.storage.removeItem(this.cacheKey);
      this.storage.setItem(this.draftKey, text);
      this.emit({ localSaved: true });
    } catch {
      this.emit({ localSaved: false });
    }
  }
  private cache(row: SaveRow) {
    try {
      const previous = this.readCache();
      if (!previous || previous.revision <= row.revision)
        this.storage.setItem(
          this.cacheKey,
          JSON.stringify({ ...row, userId: this.userId, savedAt: Date.now() }),
        );
    } catch {
      /* A confirmed cloud save is still durable without this cache. */
    }
  }
  /** Запоминает версию как «нашу»: если она окажется в облаке, это не чужая запись. */
  private remember(state: GameState) {
    for (const mark of marks(state))
      if (!this.sent.includes(mark)) this.sent.push(mark);
    if (this.sent.length > SENT_LIMIT)
      this.sent.splice(0, this.sent.length - SENT_LIMIT);
  }
  private known(row: SaveRow) {
    return this.sent.includes(fingerprint(row.state));
  }
  /** Принимает облачную строку как новую опорную точку: номер версии, копия, отпечатки. */
  private adopt(row: SaveRow) {
    this.revision = row.revision;
    this.base = row.state;
    this.cache(row);
    this.remember(row.state);
  }
  /**
   * Пробует слить три версии (общий предок + обе разошедшиеся правки) в одну и
   * проверяет результат так же строго, как перед обычной отправкой. При любой
   * проблеме возвращает null — тогда остаётся прежний путь, окно ручного выбора.
   */
  private tryAutoMerge(base: GameState, local: GameState, remote: SaveRow): GameState | null {
    try {
      const merged = mergeStates(base, local, remote.state);
      validateState(merged);
      return merged;
    } catch {
      return null;
    }
  }
  /** Сохраняет прежнюю версию в отдельную копию; хранятся только самые свежие. */
  private keepRecovery(state: GameState | null, kind: RecoveryKind) {
    if (!state) return true;
    const prefix = `${this.cacheKey}:${kind}:`;
    try {
      this.storage.setItem(
        `${prefix}${Date.now()}-${++this.copyCounter}`,
        JSON.stringify(state),
      );
    } catch {
      return false;
    }
    try {
      const order = (key: string) =>
        key
          .slice(prefix.length)
          .split('-')
          .map((part) => Number(part) || 0);
      const keys: string[] = [];
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key?.startsWith(prefix)) keys.push(key);
      }
      keys.sort((a, b) => {
        const [at, ac] = order(a),
          [bt, bc] = order(b);
        return at - bt || ac - bc;
      });
      for (const key of keys.slice(0, Math.max(0, keys.length - RECOVERY_KEEP)))
        this.storage.removeItem(key);
    } catch {
      /* Лишние копии не мешают работе. */
    }
    return true;
  }
  /**
   * Версия подтверждена облаком: черновики больше не нужны. Более старые черновики
   * других вкладок не пропадают молча, а уходят в страховочные копии.
   */
  private finishDraft(saved: GameState | null) {
    try {
      this.storage.removeItem(this.draftKey);
    } catch {
      /* Confirmed data also remains in the cloud. */
    }
    const [newest, ...older] = this.copies;
    this.copies = [];
    const savedMarks = saved ? marks(saved) : [];
    for (const copy of [newest, ...older]) {
      if (!copy) continue;
      try {
        if (this.storage.getItem(copy.key) !== copy.raw) continue;
        const same = savedMarks.includes(fingerprint(copy.draft.state));
        if (copy !== newest && !same) this.keepRecovery(copy.draft.state, 'retired');
        this.storage.removeItem(copy.key);
      } catch {
        /* Retain copy when storage is unavailable. */
      }
    }
  }
  async start(create: () => GameState) {
    const cache = this.readCache();
    this.copies = this.readDrafts();
    const recovered = this.copies[0]?.draft ?? null;
    this.clock = Math.max(this.clock, recovered?.savedAt ?? 0, cache?.savedAt ?? 0);
    this.sent = recovered ? [...recovered.sent] : [];
    this.dirty = false;
    try {
      let remote = await this.driver.load();
      if (!this.active) return;
      if (!remote)
        remote = await this.driver.create(
          recovered?.state ?? cache?.state ?? create(),
        );
      if (!this.active) return;
      if (!recovered) {
        this.adopt(remote);
        this.emit({
          state: remote.state,
          status: 'saved',
          message: SAVED_TEXT,
          remote: null,
        });
        return;
      }
      if (marks(recovered.state).includes(fingerprint(remote.state))) {
        this.adopt(remote);
        this.dirty = false;
        this.finishDraft(remote.state);
        this.emit({
          state: remote.state,
          status: 'saved',
          remote: null,
          message: SAVED_TEXT,
        });
        return;
      }
      this.dirty = true;
      this.emit({ state: recovered.state, localSaved: true });
      // Облако изменено другим устройством, только если там лежит не наша запись.
      if (recovered.revision !== remote.revision && !this.known(remote)) {
        // Если у черновика сохранилась общая точка отсчёта — пробуем слить правки
        // обоих устройств автоматически, как при обычном расхождении во время работы.
        const merged =
          recovered.base && this.tryAutoMerge(recovered.base, recovered.state, remote);
        if (merged) {
          this.adopt(remote);
          this.dirty = true;
          this.emit({
            state: merged,
            status: 'pending',
            message: 'Объединяем правки с обоих устройств…',
          });
          this.persistDraft();
          void this.flush();
          return;
        }
        this.cache(remote);
        this.emit({
          status: 'conflict',
          remote,
          message:
            'На другом устройстве сохранена более новая версия. Обе копии сохранены.',
        });
        return;
      }
      this.adopt(remote);
      this.emit({
        status: 'pending',
        message: 'Отправляем сохранённые изменения…',
      });
      this.persistDraft();
      void this.flush();
    } catch (error) {
      if (!this.active) return;
      const local = recovered ?? cache;
      if (local) {
        this.revision = local.revision;
        this.dirty = !!recovered;
        if (!recovered && cache) this.remember(cache.state);
        this.emit({
          state: local.state,
          status: 'offline',
          message: saveError(error),
        });
      } else this.emit({ status: 'error', message: saveError(error) });
    }
  }
  change(state: GameState) {
    if (
      !this.active ||
      this.snapshot.status === 'conflict' ||
      !this.snapshot.state
    )
      return;
    if (!this.dirty) this.firstDirtyAt = Date.now();
    this.edit++;
    this.dirty = true;
    this.emit({ state, status: 'pending', message: 'Сохраняем изменения…' });
    this.persistDraft();
    clearTimeout(this.timer);
    const wait = Math.max(
      0,
      Math.min(DEBOUNCE_MS, this.firstDirtyAt + MAX_WAIT_MS - Date.now()),
    );
    this.timer = setTimeout(() => void this.flush(), wait);
  }
  async refresh() {
    if (
      !this.active ||
      this.dirty ||
      this.inFlight ||
      this.snapshot.status === 'conflict' ||
      !this.snapshot.state
    )
      return;
    try {
      const row = await this.driver.load();
      if (!this.active || this.dirty || this.inFlight) return;
      if (!row) {
        this.emit({
          status: 'error',
          message:
            'Облачная игра недоступна. Скачайте локальную копию перед повторным подключением.',
        });
        return;
      }
      if (row.revision > this.revision) {
        this.adopt(row);
        this.emit({
          state: row.state,
          status: 'saved',
          message: 'Загружен прогресс из аккаунта',
        });
      } else this.emit({ status: 'saved', message: SAVED_TEXT });
    } catch (error) {
      if (this.active)
        this.emit({ status: 'offline', message: saveError(error) });
    }
  }
  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.inFlight) return this.inFlight;
    if (!this.active || this.snapshot.status === 'conflict')
      return Promise.resolve();
    if (!this.dirty) return this.refresh();
    this.inFlight = this.run().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }
  /** Шаг многошаговой записи: версия, которую мы вот-вот отправим или уже отправили. */
  private progress(step: SaveRow, committed: boolean) {
    if (!this.active) return false;
    const before = this.sent.length;
    this.remember(step.state);
    if (committed) this.revision = step.revision;
    // Отпечаток и номер версии должны пережить закрытие страницы посреди записи.
    if (committed || this.sent.length !== before) this.persistDraft();
    return true;
  }
  /** Облако подтвердило именно эту версию. */
  private confirm(row: SaveRow, edit: number) {
    this.adopt(row);
    if (edit === this.edit) {
      this.dirty = false;
      this.finishDraft(row.state);
      this.emit({ status: 'saved', message: SAVED_TEXT, remote: null });
    } else this.persistDraft();
  }
  private async run() {
    let rebases = 0,
      merges = 0;
    while (
      this.active &&
      this.dirty &&
      this.snapshot.state &&
      this.snapshot.status !== 'conflict'
    ) {
      const state = this.snapshot.state,
        edit = this.edit,
        revision = this.revision;
      // Отпечаток записывается до отправки: потерянный ответ не должен выглядеть как чужая запись.
      this.remember(state);
      this.persistDraft();
      this.emit({ status: 'saving', message: 'Сохраняем в аккаунте…' });
      try {
        const row = await this.driver.save(state, revision, (step, committed) =>
          this.progress(step, committed),
        );
        if (!this.active) return;
        if (row) {
          this.confirm(row, edit);
          continue;
        }
        const remote = await this.driver.load();
        if (!this.active) return;
        if (remote && marks(state).includes(fingerprint(remote.state))) {
          // Запись дошла, а ответ потерялся: в облаке уже именно эта версия.
          this.confirm(remote, edit);
          continue;
        }
        if (remote && this.known(remote) && rebases < REBASE_LIMIT) {
          // В облаке наша прежняя запись: продолжаем поверх неё, ничего чужого не затираем.
          rebases++;
          this.adopt(remote);
          continue;
        }
        if (remote && this.base && merges < MERGE_LIMIT) {
          // Облако действительно изменило другое устройство — пробуем слить правки,
          // а не сразу останавливаться и спрашивать игрока.
          const merged = this.tryAutoMerge(this.base, state, remote);
          if (merged) {
            merges++;
            this.adopt(remote);
            this.emit({ state: merged, status: 'saving', message: 'Сохраняем в аккаунте…' });
            this.persistDraft();
            continue;
          }
        }
        this.emit({
          status: 'conflict',
          remote,
          message:
            'Прогресс изменён на другом устройстве. Ваши изменения не перезаписаны.',
        });
        this.persistDraft();
        return;
      } catch (error) {
        if (this.active) {
          this.persistDraft();
          this.emit({ status: 'offline', message: saveError(error) });
        }
        return;
      }
    }
  }
  async chooseRemote(backupDownloaded = false) {
    const remote = this.snapshot.remote;
    if (!remote)
      throw new Error('Облачная версия недоступна. Повторите загрузку.');
    if (!this.keepRecovery(this.snapshot.state, 'recovery') && !backupDownloaded)
      throw new Error('Сначала скачайте резервную копию своих изменений.');
    this.sent = [];
    this.adopt(remote);
    this.dirty = false;
    this.finishDraft(remote.state);
    this.emit({
      state: remote.state,
      status: 'saved',
      remote: null,
      message: 'Открыта облачная версия. Предыдущая копия сохранена.',
    });
  }
  async chooseLocal() {
    const remote = this.snapshot.remote;
    if (!remote)
      throw new Error('Облачная версия недоступна. Повторите загрузку.');
    // Облачная версия будет заменена: оставляем её копию на случай, если выбор окажется ошибкой.
    this.keepRecovery(remote.state, 'recovery');
    this.adopt(remote);
    // `adopt()` для записи поверх нужен только номер версии — отброшенная игроком
    // облачная версия не должна становиться опорной точкой для будущих автослияний
    // (иначе её накопительные поля, например xp, снова примешаются к локальным при
    // следующем конфликте, хотя игрок уже явно отказался от этой версии). Опорная
    // точка — само сохраняемое сейчас состояние устройства.
    this.base = this.snapshot.state;
    this.dirty = true;
    this.emit({
      status: 'pending',
      remote: null,
      message: 'Сохраняем выбранную версию…',
    });
    this.persistDraft();
    await this.flush();
  }
  dispose() {
    this.active = false;
    clearTimeout(this.timer);
    this.listeners.clear();
  }
}
