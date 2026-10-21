/** OAuth bridge for TickTick Open API v1. Provider tokens stay on the server. */
import { firebaseIdentity } from './firebaseIdentity.ts';
import { emptyTickTickSettings, validateTickTickSettings } from '../../src/ticktickSettings.ts';
import { emptyHabitLinks, normalizeCheckins, normalizeHabits, normalizeSections, stampOf, validRange, validateHabitLinks } from '../../src/ticktickHabits.ts';
import type { HabitLinksState, HabitSection } from '../../src/ticktickHabits.ts';
export interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<unknown>;
}
interface ObjectState {
  storage: Storage;
}
export interface Env {
  TICKTICK_CLIENT_ID: string;
  TICKTICK_CLIENT_SECRET: string;
  APP_URL: string;
  FIREBASE_PROJECT_ID?: string;
  /** Адрес официального MCP-сервера TickTick; по умолчанию https://mcp.ticktick.com/. Нужен тестам. */
  TICKTICK_MCP_URL?: string;
  ACCOUNTS: {
    idFromName(name: string): { toString(): string };
    idFromString(id: string): { toString(): string };
    get(id: { toString(): string }): {
      fetch(request: Request): Promise<Response>;
    };
  };
}
export class BridgeError extends Error {
  status: number;
  /** Код ответа TickTick, если ошибка пришла от него. */
  upstream?: number;
  /** Безопасный код для диагностики, например TICKTICK_AUTH_REQUIRED. */
  code?: string;
  constructor(message: string, status = 502, upstream?: number, code?: string) {
    super(message);
    this.status = status;
    this.upstream = upstream;
    this.code = code;
  }
}
function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}
async function body(request: Request, limit = 65000): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > limit)
    throw new BridgeError('Слишком большой запрос.', 413);
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new BridgeError('Некорректный запрос.', 400);
  }
}
const nonce = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
    (n) => n.toString(16).padStart(2, '0'),
  ).join('');
}
interface Token {
  access_token: string;
  refresh_token?: string;
  expiresAt: number;
}
export class TickTickAccount {
  private storage: Storage;
  private env: Env;
  private serial: Promise<unknown> = Promise.resolve();
  /** Время последних запросов к маршрутам привычек: простой лимит, чтобы синхронизация не перегружала TickTick. */
  private habitHits: number[] = [];
  constructor(state: ObjectState, env: Env) {
    this.storage = state.storage;
    this.env = env;
  }
  fetch(request: Request): Promise<Response> {
    const next = this.serial
      .then(() => this.handle(request))
      .catch((error) =>
        json(
          {
            error:
              error instanceof BridgeError
                ? error.message
                : 'Не удалось обработать запрос TickTick.',
            ...(error instanceof BridgeError && error.code ? { code: error.code } : {}),
          },
          error instanceof BridgeError ? error.status : 500,
        ),
      );
    this.serial = next;
    return next;
  }
  private async exchange(params: URLSearchParams): Promise<Token> {
    const response = await fetch('https://ticktick.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${this.env.TICKTICK_CLIENT_ID}:${this.env.TICKTICK_CLIENT_SECRET}`)}`,
      },
      body: params,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new BridgeError(
        'TickTick не подтвердил подключение. Подключи аккаунт заново.',
        401,
      );
    const data = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!data.access_token)
      throw new BridgeError('TickTick не выдал доступ.', 401);
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in ?? 15552000) * 1000,
    };
  }
  private async token(): Promise<string> {
    let token = await this.storage.get<Token>('token');
    if (!token) throw new BridgeError('Подключи аккаунт TickTick.', 401);
    if (token.expiresAt < Date.now() + 60000) {
      if (!token.refresh_token)
        throw new BridgeError(
          'Срок подключения истёк. Подключи TickTick заново.',
          401,
        );
      const fresh = await this.exchange(
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: token.refresh_token,
          scope: 'tasks:read tasks:write',
        }),
      );
      token = {
        ...fresh,
        refresh_token: fresh.refresh_token ?? token.refresh_token,
      };
      await this.storage.put('token', token);
    }
    return token.access_token;
  }
  private async api(
    path: string,
    method = 'GET',
    payload?: unknown,
  ): Promise<Response> {
    const response = await fetch(`https://api.ticktick.com/open/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'Content-Type': 'application/json',
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok && response.status !== 404)
      throw new BridgeError(
        response.status === 401
          ? 'Доступ TickTick истёк. Подключи аккаунт заново.'
          : response.status === 429
            ? 'TickTick просит подождать. Повтори синхронизацию позже.'
            : 'TickTick отклонил запрос. Изменения не подтверждены.',
        response.status === 401 ? 401 : response.status === 429 ? 429 : 502,
        response.status,
      );
    return response;
  }
  /** Один вызов инструмента официального MCP-сервера TickTick (Streamable HTTP, JSON-RPC). Токен остаётся на сервере. */
  private async mcp(tool: string, args: Record<string, unknown>): Promise<unknown> {
    const base = this.env.TICKTICK_MCP_URL || 'https://mcp.ticktick.com/';
    const token = await this.token();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    const post = async (payload: unknown, session?: string) => {
      let response: Response;
      try {
        response = await fetch(base, {
          method: 'POST',
          headers: session ? { ...headers, 'Mcp-Session-Id': session } : headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20000),
        });
      } catch {
        throw new BridgeError('TickTick сейчас недоступен. Повтори позже.', 502, undefined, 'TICKTICK_UNAVAILABLE');
      }
      if (response.status === 401)
        throw new BridgeError('Доступ TickTick истёк. Подключи аккаунт заново.', 401, 401, 'TICKTICK_AUTH_REQUIRED');
      if (response.status === 403)
        throw new BridgeError('TickTick не разрешил доступ к привычкам. Подключи аккаунт заново и разреши доступ.', 403, 403, 'TICKTICK_HABIT_SCOPE_DENIED');
      if (response.status === 429)
        throw new BridgeError('TickTick просит подождать. Повтори синхронизацию позже.', 429, 429, 'TICKTICK_RATE_LIMIT');
      if (!response.ok)
        throw new BridgeError('TickTick отклонил запрос. Изменения не подтверждены.', 502, response.status, 'TICKTICK_REQUEST_FAILED');
      return response;
    };
    const parse = async (response: Response, id: number): Promise<Record<string, unknown> | undefined> => {
      const raw = await response.text();
      if (!raw.trim()) return undefined;
      const candidates = (response.headers.get('content-type') ?? '').includes('text/event-stream')
        ? raw.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim())
        : [raw];
      for (const item of candidates.reverse()) {
        try {
          const value = JSON.parse(item);
          if (value && typeof value === 'object' && !Array.isArray(value) && (value as { id?: number }).id === id) return value as Record<string, unknown>;
        } catch { /* некорректная строка потока пропускается */ }
      }
      return undefined;
    };
    const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'play-your-life', version: '1' } } });
    const session = init.headers.get('Mcp-Session-Id') ?? undefined;
    await init.text();
    await (await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, session)).text();
    const response = await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: args } }, session);
    const message = await parse(response, 2);
    const failed = () => new BridgeError('TickTick вернул ошибку при работе с привычками.', 502, undefined, 'TICKTICK_HABITS_ERROR');
    if (!message || message.error) throw failed();
    const result = message.result as { isError?: boolean; structuredContent?: unknown; content?: { type?: string; text?: string }[] } | undefined;
    if (!result || result.isError) throw failed();
    if (result.structuredContent !== undefined) return result.structuredContent;
    const textPart = result.content?.find((part) => part.type === 'text')?.text;
    if (textPart === undefined) return {};
    try { return JSON.parse(textPart); } catch { throw failed(); }
  }
  private async habitSections(): Promise<HabitSection[]> {
    return normalizeSections(await this.mcp('list_habit_sections', {}));
  }
  private async habitLinks(): Promise<HabitLinksState> {
    return (await this.storage.get<HabitLinksState>('habitLinks')) ?? emptyHabitLinks();
  }
  private async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/authorize' && request.method === 'POST') {
      const id = request.headers.get('X-Account-Id');
      if (!id) throw new BridgeError('Не найден аккаунт.', 400);
      const state = `${id}.${nonce()}`;
      await this.storage.put('pending', {
        state,
        expires: Date.now() + 600000,
        callback: `${url.origin}/callback`,
      });
      const target = new URL('https://ticktick.com/oauth/authorize');
      target.search = new URLSearchParams({
        client_id: this.env.TICKTICK_CLIENT_ID,
        scope: 'tasks:read tasks:write',
        state,
        redirect_uri: `${url.origin}/callback`,
        response_type: 'code',
      }).toString();
      return json({ url: target.toString() });
    }
    if (url.pathname === '/callback') {
      const pending = await this.storage.get<{
        state: string;
        expires: number;
        callback: string;
      }>('pending');
      if (
        !pending ||
        pending.state !== url.searchParams.get('state') ||
        pending.expires < Date.now()
      )
        throw new BridgeError(
          'Ссылка подключения истекла. Вернись в приложение и начни заново.',
          400,
        );
      await this.storage.delete('pending');
      const code = url.searchParams.get('code');
      if (!code || url.searchParams.get('error'))
        return Response.redirect(`${this.env.APP_URL}#ticktick=cancelled`, 302);
      let token: Token;
      try { token = await this.exchange(
        new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          scope: 'tasks:read tasks:write',
          redirect_uri: pending.callback,
        }),
      ); } catch {
        return Response.redirect(`${this.env.APP_URL}#ticktick=failed`, 302);
      }
      await this.storage.put('token', token);
      // Another TickTick login may be a different account. Never retain its task IDs.
      const settings = await this.storage.get<ReturnType<typeof emptyTickTickSettings>>('settings');
      await this.storage.put('settings', emptyTickTickSettings((settings?.revision ?? 0) + 1));
      await this.storage.put('epoch', (await this.storage.get<number>('epoch') ?? 0) + 1);
      // Другой аккаунт TickTick: связи привычек и ключи отметок прежнего не переносятся.
      await this.storage.put('habitLinks', emptyHabitLinks(((await this.storage.get<HabitLinksState>('habitLinks'))?.revision ?? 0) + 1));
      await this.storage.delete('habitKeys');
      return Response.redirect(`${this.env.APP_URL}#ticktick=connected`, 302);
    }
    if (url.pathname === '/disconnect' && request.method === 'POST') {
      await this.storage.delete('token');
      await this.storage.delete('pending');
      const settings = await this.storage.get<ReturnType<typeof emptyTickTickSettings>>('settings');
      await this.storage.put('settings', emptyTickTickSettings((settings?.revision ?? 0) + 1));
      await this.storage.put('epoch', (await this.storage.get<number>('epoch') ?? 0) + 1);
      await this.storage.put('habitLinks', emptyHabitLinks(((await this.storage.get<HabitLinksState>('habitLinks'))?.revision ?? 0) + 1));
      await this.storage.delete('habitKeys');
      return json({ connected: false });
    }
    if (url.pathname === '/status' && request.method === 'GET') {
      const token = await this.storage.get<Token>('token');
      return json({ connected: Boolean(token && (token.expiresAt > Date.now() + 60000 || token.refresh_token)) });
    }
    if (url.pathname === '/settings' && request.method === 'GET') {
      return json(await this.storage.get('settings') ?? emptyTickTickSettings());
    }
    if (url.pathname === '/settings' && request.method === 'PUT') {
      if (!await this.storage.get('token')) throw new BridgeError('Сначала подключи аккаунт TickTick.', 401);
      let settings;
      try { settings = validateTickTickSettings(await body(request, 900000)); }
      catch { throw new BridgeError('Некорректные настройки TickTick.', 400); }
      const current = await this.storage.get<ReturnType<typeof emptyTickTickSettings>>('settings') ?? emptyTickTickSettings();
      if (settings.revision !== current.revision) throw new BridgeError('Настройки изменены на другом устройстве. Обнови подключение перед сохранением.', 409);
      const next = { ...settings, revision: current.revision + 1 };
      await this.storage.put('settings', next);
      return json(next);
    }
    if (url.pathname === '/create' && request.method === 'POST') {
      const data = await body(request);
      const localId = data.localId;
      const project = data.projectId;
      if (
        typeof localId !== 'string' ||
        !/^[\w-]{1,100}$/.test(localId) ||
        typeof project !== 'string' ||
        !/^[\w-]{1,100}$/.test(project) ||
        typeof data.title !== 'string' ||
        typeof data.content !== 'string'
      )
        throw new BridgeError('Проверь задачу.', 400);
      const epoch = await this.storage.get<number>('epoch');
      const key = epoch ? `task:${epoch}:${project}:${localId}` : `task:${project}:${localId}`;
      const previous = await this.storage.get<{
        id?: string;
        pending?: boolean;
        at?: number;
      }>(key);
      if (previous?.id) {
        const existing = await this.api(
          `/project/${project}/task/${previous.id}`,
        );
        if (existing.ok) return json(await existing.json());
        throw new BridgeError(
          'Ранее созданная задача удалена в TickTick. Выполни синхронизацию списка.',
          409,
        );
      }
      const marker = `[PYL:${localId}]`;
      const list = await this.api(`/project/${project}/data`);
      if (!list.ok) throw new BridgeError('Список TickTick не найден.', 404);
      const projectData = (await list.json()) as {
        tasks?: { id: string; content?: string }[];
      };
      const recovered = projectData.tasks?.find((task) =>
        task.content?.includes(marker),
      );
      if (recovered) {
        await this.storage.put(key, { id: recovered.id });
        return json(recovered);
      }
      // Метка без времени (старая) или старше 10 минут больше не блокирует: список выше уже проверен.
      if (previous?.pending && previous.at && Date.now() - previous.at < 600000)
        throw new BridgeError(
          'TickTick не подтвердил создание задачи. Проверь список TickTick перед повторной передачей — повторное создание остановлено.',
          409,
        );
      await this.storage.put(key, { pending: true, at: Date.now() });
      const { localId: ignored, ...task } = data;
      void ignored;
      task.content = `${String(data.content).replace(/\n?\[PYL:[\w-]+\]/g, '')}\n${marker}`;
      let created: Response;
      try {
        created = await this.api('/task', 'POST', task);
      } catch (error) {
        // Ответ 4xx значит, что TickTick задачу не создал: повтор безопасен. Сетевой сбой или 5xx — исход неизвестен.
        if (
          error instanceof BridgeError &&
          error.upstream !== undefined &&
          error.upstream >= 400 &&
          error.upstream < 500
        )
          await this.storage.delete(key);
        throw error;
      }
      if (!created.ok)
        throw new BridgeError('Создание задачи не подтверждено.', 502);
      const value = (await created.json()) as { id?: string };
      if (!value.id)
        throw new BridgeError('TickTick не подтвердил создание задачи.', 502);
      await this.storage.put(key, { id: value.id });
      return json(value);
    }
    if (url.pathname === '/habits' || url.pathname.startsWith('/habits/')) {
      const now = Date.now();
      this.habitHits = this.habitHits.filter((time) => now - time < 60000);
      if (this.habitHits.length >= 60)
        throw new BridgeError('Слишком много запросов привычек. Повтори через минуту.', 429, undefined, 'RATE_LIMITED');
      this.habitHits.push(now);
    }
    if (url.pathname === '/habits' && request.method === 'GET') {
      if (!await this.storage.get('token')) throw new BridgeError('Подключи аккаунт TickTick.', 401, undefined, 'TICKTICK_AUTH_REQUIRED');
      const sections = await this.habitSections();
      const items = normalizeHabits(await this.mcp('list_habits', {}), sections).slice(0, 500);
      return json({ items, sections });
    }
    if (url.pathname === '/habits/checkins' && request.method === 'GET') {
      if (!await this.storage.get('token')) throw new BridgeError('Подключи аккаунт TickTick.', 401, undefined, 'TICKTICK_AUTH_REQUIRED');
      let range: { from: string; to: string };
      try { range = validRange(url.searchParams.get('from') ?? '', url.searchParams.get('to') ?? ''); }
      catch { throw new BridgeError('Проверь период истории.', 400, undefined, 'INVALID_RANGE'); }
      const ids = (url.searchParams.get('habitIds') ?? '').split(',').map((v) => v.trim()).filter(Boolean);
      if (!ids.length || ids.length > 200 || ids.some((v) => !/^[\w-]{1,100}$/.test(v)))
        throw new BridgeError('Проверь список привычек.', 400, undefined, 'INVALID_HABITS');
      const items = [];
      // Запросы пачками: список и период ограничены, чтобы не перегружать TickTick.
      for (let i = 0; i < ids.length; i += 20)
        items.push(...normalizeCheckins(await this.mcp('get_habit_checkins', { habit_ids: ids.slice(i, i + 20), from_stamp: stampOf(range.from), to_stamp: stampOf(range.to) })));
      return json({ items, from: range.from, to: range.to });
    }
    if (url.pathname === '/habits/checkin' && request.method === 'POST') {
      if (!await this.storage.get('token')) throw new BridgeError('Подключи аккаунт TickTick.', 401, undefined, 'TICKTICK_AUTH_REQUIRED');
      const data = await body(request, 4000);
      const habitId = data.ticktickHabitId;
      const date = data.date;
      const key = data.idempotencyKey;
      const value = data.value ?? 1;
      const goal = data.goal ?? 1;
      const completed = data.completed ?? true;
      if (typeof habitId !== 'string' || !/^[\w-]{1,100}$/.test(habitId) || typeof date !== 'string' || typeof key !== 'string' || !/^[\w:.-]{8,200}$/.test(key)
        || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000000
        || typeof goal !== 'number' || !Number.isFinite(goal) || goal <= 0 || goal > 1000000 || typeof completed !== 'boolean')
        throw new BridgeError('Проверь отметку привычки.', 400, undefined, 'INVALID_CHECKIN');
      let stamp: number;
      try { stamp = stampOf(date); } catch { throw new BridgeError('Проверь дату отметки.', 400, undefined, 'INVALID_CHECKIN'); }
      if (date > new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)) throw new BridgeError('Отметку нельзя поставить на будущий день.', 400, undefined, 'INVALID_CHECKIN');
      // Повтор того же запроса безопасен: сохранённый результат возвращается без нового обращения к TickTick.
      const seen = (await this.storage.get<{ key: string; result: unknown }[]>('habitKeys')) ?? [];
      const previous = seen.find((item) => item.key === key);
      if (previous) return json({ ...(previous.result as object), repeated: true });
      const now = new Date().toISOString();
      await this.mcp('upsert_habit_checkins', { habit_id: habitId, checkin_data: { stamp, value, goal, status: completed ? 2 : 0, time: now, opTime: now } });
      const result = { status: 'synced', ticktickHabitId: habitId, date, value, goal, completed };
      await this.storage.put('habitKeys', [...seen, { key, result }].slice(-500));
      return json(result);
    }
    // Настоящего удаления привычки официальный MCP-сервер TickTick не предоставляет (есть только список, чтение,
    // создание, обновление и отметки) — ближайший доступный эквивалент удалению в игре - перевод в архив (status 2),
    // тот же статус, что игра уже распознаёт как «archived» при чтении (src/ticktickHabits.ts).
    if (url.pathname === '/habits/archive' && request.method === 'POST') {
      if (!await this.storage.get('token')) throw new BridgeError('Подключи аккаунт TickTick.', 401, undefined, 'TICKTICK_AUTH_REQUIRED');
      const data = await body(request, 500);
      const habitId = data.ticktickHabitId;
      if (typeof habitId !== 'string' || !/^[\w-]{1,100}$/.test(habitId))
        throw new BridgeError('Проверь привычку для архивации.', 400, undefined, 'INVALID_HABITS');
      await this.mcp('update_habit', { habit_id: habitId, habit: { id: habitId, status: 2 } });
      return json({ status: 'archived', ticktickHabitId: habitId });
    }
    if (url.pathname === '/habits/links' && request.method === 'GET') {
      return json(await this.habitLinks());
    }
    if (url.pathname === '/habits/links' && request.method === 'PUT') {
      if (!await this.storage.get('token')) throw new BridgeError('Сначала подключи аккаунт TickTick.', 401, undefined, 'TICKTICK_AUTH_REQUIRED');
      let next: HabitLinksState;
      try { next = validateHabitLinks(await body(request, 900000)); }
      catch { throw new BridgeError('Некорректные связи привычек.', 400, undefined, 'INVALID_HABIT_LINKS'); }
      const current = await this.habitLinks();
      if (next.revision !== current.revision) throw new BridgeError('Связи привычек изменены на другом устройстве. Обнови подключение перед сохранением.', 409, undefined, 'HABIT_LINKS_CONFLICT');
      const saved = { ...next, revision: current.revision + 1 };
      await this.storage.put('habitLinks', saved);
      return json(saved);
    }
    const path = url.pathname.replace(/^\/api/, '');
    // Only the official task/project endpoints are exposed; no arbitrary upstream URLs.
    const allowed =
      (request.method === 'GET' &&
        /^\/project(?:\/[\w-]+(?:\/data|\/task\/[\w-]+)?)?$/.test(path)) ||
      (request.method === 'POST' &&
        (/^\/task\/[\w-]+$/.test(path) ||
          /^\/project\/[\w-]+\/task\/[\w-]+\/complete$/.test(path))) ||
      (request.method === 'DELETE' &&
        /^\/project\/[\w-]+\/task\/[\w-]+$/.test(path));
    if (!url.pathname.startsWith('/api/') || !allowed)
      throw new BridgeError('Маршрут недоступен.', 404);
    const payload =
      request.method === 'POST' && /^\/task\//.test(path)
        ? await body(request)
        : undefined;
    const response = await this.api(path, request.method, payload);
    const text = await response.text();
    return new Response(text || null, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let headers: Record<string, string> = { 'Cache-Control': 'no-store' };
    try {
      const url = new URL(request.url);
      if (!env.APP_URL) throw new BridgeError('Сервер TickTick ещё не настроен.', 503);
      const origin = new URL(env.APP_URL).origin;
      if (url.pathname === '/callback' && request.method === 'GET') {
        const id = url.searchParams.get('state')?.split('.')[0];
        if (!id || !/^[a-f0-9]{64}$/.test(id))
          return json({ error: 'Некорректная ссылка подключения.' }, 400);
        return await env.ACCOUNTS.get(env.ACCOUNTS.idFromString(id)).fetch(
          request,
        );
      }
      if (request.headers.get('Origin') !== origin)
        return json(
          { error: 'Этот сайт не имеет доступа к подключению.' },
          403,
        );
      headers = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        Vary: 'Origin',
        'Cache-Control': 'no-store',
      };
      if (request.method === 'OPTIONS')
        return new Response(null, { status: 204, headers });
      if (!env.TICKTICK_CLIENT_ID || !env.TICKTICK_CLIENT_SECRET)
        throw new BridgeError('Сервер TickTick ещё не настроен.', 503);
      const key = request.headers.get('Authorization')?.replace(/^Bearer /, '');
      if (!key) throw new BridgeError('Войдите в аккаунт PLAY YOUR LIFE.', 401, undefined, 'PLAY_LIFE_AUTH_REQUIRED');
      let name: string;
      if (/^[a-f0-9]{64}$/.test(key)) {
        // Compatibility with existing local connections; never shared with Firebase accounts.
        name = await digest(key);
      } else {
        if (!env.FIREBASE_PROJECT_ID) throw new BridgeError('Авторизация сервера ещё не настроена.', 503);
        let uid: string;
        try { uid = await firebaseIdentity(key, env.FIREBASE_PROJECT_ID); }
        catch { throw new BridgeError('Войдите в аккаунт PLAY YOUR LIFE заново.', 401); }
        name = `firebase:${env.FIREBASE_PROJECT_ID}:${uid}`;
      }
      const id = env.ACCOUNTS.idFromName(name);
      const forwarded = new Request(request);
      forwarded.headers.set('X-Account-Id', id.toString());
      const response = await env.ACCOUNTS.get(id).fetch(forwarded);
      return new Response(response.body, {
        status: response.status,
        headers: { ...Object.fromEntries(response.headers), ...headers },
      });
    } catch (error) {
      const response = json({ error: error instanceof BridgeError ? error.message : 'Сервер подключения временно недоступен.', ...(error instanceof BridgeError && error.code ? { code: error.code } : {}) }, error instanceof BridgeError ? error.status : 500);
      return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...headers } });
    }
  },
};
