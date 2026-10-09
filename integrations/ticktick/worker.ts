/** OAuth bridge for TickTick Open API v1. Provider tokens stay on the server. */
import { firebaseIdentity } from './firebaseIdentity.ts';
import { emptyTickTickSettings, validateTickTickSettings } from '../../src/ticktickSettings.ts';
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
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
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
      );
    return response;
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
      return Response.redirect(`${this.env.APP_URL}#ticktick=connected`, 302);
    }
    if (url.pathname === '/disconnect' && request.method === 'POST') {
      await this.storage.delete('token');
      await this.storage.delete('pending');
      const settings = await this.storage.get<ReturnType<typeof emptyTickTickSettings>>('settings');
      await this.storage.put('settings', emptyTickTickSettings((settings?.revision ?? 0) + 1));
      await this.storage.put('epoch', (await this.storage.get<number>('epoch') ?? 0) + 1);
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
      if (previous?.pending)
        throw new BridgeError(
          'TickTick не подтвердил создание задачи. Проверь список TickTick перед повторной передачей — повторное создание остановлено.',
          409,
        );
      await this.storage.put(key, { pending: true });
      const { localId: ignored, ...task } = data;
      void ignored;
      task.content = `${String(data.content).replace(/\n?\[PYL:[\w-]+\]/g, '')}\n${marker}`;
      const created = await this.api('/task', 'POST', task);
      if (!created.ok)
        throw new BridgeError('Создание задачи не подтверждено.', 502);
      const value = (await created.json()) as { id?: string };
      if (!value.id)
        throw new BridgeError('TickTick не подтвердил создание задачи.', 502);
      await this.storage.put(key, { id: value.id });
      return json(value);
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
      if (!key) throw new BridgeError('Войдите в аккаунт PLAY YOUR LIFE.', 401);
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
      const response = json({ error: error instanceof BridgeError ? error.message : 'Сервер подключения временно недоступен.' }, error instanceof BridgeError ? error.status : 500);
      return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...headers } });
    }
  },
};
