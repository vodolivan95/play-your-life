import type { GameState } from './game.ts';
import { restoreBackup } from './backup.ts';
import { saveError } from './saveError.ts';
export type SaveRow = { state: GameState; revision: number };
export interface SaveDriver {
  load(): Promise<SaveRow | null>;
  create(state: GameState): Promise<SaveRow>;
  save(state: GameState, revision: number): Promise<SaveRow | null>;
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
type Draft = SaveRow & { userId: string; savedAt: number };
export class AccountSave {
  private driver: SaveDriver;
  private storage: Storage;
  private userId: string;
  private cacheKey: string;
  private draftKey: string;
  private adopted: { key: string; raw: string } | null = null;
  private revision = 0;
  private dirty = false;
  private edit = 0;
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
      return {
        userId: this.userId,
        state,
        revision: d.revision,
        savedAt: d.savedAt,
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
  private readDraft() {
    const copies: { draft: Draft; key: string; raw: string }[] = [];
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
    return copies.sort((a, b) => b.draft.savedAt - a.draft.savedAt)[0] ?? null;
  }
  private persistDraft() {
    if (!this.snapshot.state) return;
    try {
      this.storage.setItem(
        this.draftKey,
        JSON.stringify({
          userId: this.userId,
          revision: this.revision,
          state: this.snapshot.state,
          savedAt: Date.now(),
        }),
      );
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
  private removeAdopted() {
    if (!this.adopted) return;
    try {
      if (this.storage.getItem(this.adopted.key) === this.adopted.raw)
        this.storage.removeItem(this.adopted.key);
    } catch {
      /* Retain copy when storage is unavailable. */
    }
    this.adopted = null;
  }
  private finishDraft() {
    try {
      this.storage.removeItem(this.draftKey);
    } catch {
      /* Confirmed data also remains in the cloud. */
    }
    this.removeAdopted();
  }
  async start(create: () => GameState) {
    const cache = this.readCache(),
      recovered = this.readDraft();
    this.adopted = recovered
      ? { key: recovered.key, raw: recovered.raw }
      : null;
    try {
      let remote = await this.driver.load();
      if (!this.active) return;
      if (!remote)
        remote = await this.driver.create(
          recovered?.draft.state ?? cache?.state ?? create(),
        );
      if (!this.active) return;
      this.revision = remote.revision;
      this.cache(remote);
      if (
        recovered &&
        JSON.stringify(recovered.draft.state) === JSON.stringify(remote.state)
      ) {
        this.dirty = false;
        this.finishDraft();
        this.emit({
          state: remote.state,
          status: 'saved',
          remote: null,
          message: 'Прогресс сохранён в аккаунте',
        });
      } else if (recovered) {
        this.dirty = true;
        this.emit({ state: recovered.draft.state, localSaved: true });
        if (recovered.draft.revision !== remote.revision) {
          this.emit({
            status: 'conflict',
            remote,
            message:
              'На другом устройстве сохранена более новая версия. Обе копии сохранены.',
          });
          return;
        }
        this.emit({
          status: 'pending',
          message: 'Отправляем сохранённые изменения…',
        });
        this.persistDraft();
        void this.flush();
      } else
        this.emit({
          state: remote.state,
          status: 'saved',
          message: 'Прогресс сохранён в аккаунте',
          remote: null,
        });
    } catch (error) {
      if (!this.active) return;
      const local = recovered?.draft ?? cache;
      if (local) {
        this.revision = local.revision;
        this.dirty = !!recovered;
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
    this.edit++;
    this.dirty = true;
    this.emit({ state, status: 'pending', message: 'Сохраняем изменения…' });
    this.persistDraft();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 650);
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
        this.revision = row.revision;
        this.cache(row);
        this.emit({
          state: row.state,
          status: 'saved',
          message: 'Загружен прогресс из аккаунта',
        });
      } else
        this.emit({ status: 'saved', message: 'Прогресс сохранён в аккаунте' });
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
  private async run() {
    while (
      this.active &&
      this.dirty &&
      this.snapshot.state &&
      this.snapshot.status !== 'conflict'
    ) {
      const state = this.snapshot.state,
        edit = this.edit,
        revision = this.revision;
      this.emit({ status: 'saving', message: 'Сохраняем в аккаунте…' });
      try {
        const row = await this.driver.save(state, revision);
        if (!this.active) return;
        if (!row) {
          const remote = await this.driver.load();
          if (!this.active) return;
          this.emit({
            status: 'conflict',
            remote,
            message:
              'Прогресс изменён на другом устройстве. Ваши изменения не перезаписаны.',
          });
          this.persistDraft();
          return;
        }
        this.revision = row.revision;
        this.cache(row);
        if (edit === this.edit) {
          this.dirty = false;
          this.finishDraft();
          this.emit({
            status: 'saved',
            message: 'Прогресс сохранён в аккаунте',
            remote: null,
          });
        } else this.persistDraft();
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
    try {
      this.storage.setItem(
        `${this.cacheKey}:recovery:${Date.now()}`,
        JSON.stringify(this.snapshot.state),
      );
    } catch {
      if (!backupDownloaded)
        throw new Error('Сначала скачайте резервную копию своих изменений.');
    }
    this.revision = remote.revision;
    this.dirty = false;
    this.finishDraft();
    this.cache(remote);
    this.emit({
      state: remote.state,
      status: 'saved',
      remote: null,
      message: 'Открыта облачная версия. Предыдущая копия сохранена.',
    });
  }
  async chooseLocal() {
    if (!this.snapshot.remote)
      throw new Error('Облачная версия недоступна. Повторите загрузку.');
    this.revision = this.snapshot.remote.revision;
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
