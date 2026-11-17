import { DriveError } from './security.ts';

/** Microsoft's Entra portal API. This is not the application's registration. */
export const ENTRA_PORTAL_CLIENT_ID = '74658136-14ec-4630-ad9b-26e160ff0fc6';
export const scopes = ['User.Read', 'Files.ReadWrite'];
export type AuthStage = 'authorize' | 'callback' | 'token_exchange' | 'nonce' | 'refresh' | 'graph_profile' | 'graph_drive' | 'graph_files';
export type AuthDiagnostic = { code: string; stage: AuthStage; correlationId: string; message: string };
export class OneDriveAuthError extends DriveError {
  diagnostic: AuthDiagnostic;
  constructor(diagnostic: AuthDiagnostic, status = 401) { super(status, diagnostic.message); this.diagnostic = diagnostic; }
}
const reconnectCodes = new Set(['invalid_grant', 'interaction_required', 'consent_required', 'login_required', 'AADSTS65001', 'AADSTS50058', 'AADSTS50076', 'AADSTS50079', 'AADSTS70000', 'AADSTS70008', 'AADSTS700082', 'AADSTS700084', 'AADSTS50173', 'RECONNECT_REQUIRED']);
const providerCodes = new Set([...reconnectCodes, 'access_denied', 'user_cancelled', 'invalid_client', 'unauthorized_client', 'invalid_scope', 'temporarily_unavailable', 'server_error', 'network_error', 'OAUTH_NONCE_MISMATCH']);
/** Only allow-listed codes/our correlation ID are retained. Never serialize SDK errors or descriptions. */
export function authDiagnostic(error: unknown, stage: AuthStage): AuthDiagnostic {
  const data = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const text = [data.errorMessage, data.error_description, data.message].filter(v => typeof v === 'string').join(' ').slice(0, 16000);
  const aadsts = text.match(/\bAADSTS(\d{4,9})\b/)?.[0];
  const providerCode = [data.errorCode, data.error].find(value => typeof value === 'string' && providerCodes.has(value)) as string | undefined;
  const code = aadsts || providerCode || (data.status === 401 ? 'RECONNECT_REQUIRED' : data.status && Number.isInteger(data.status) ? `HTTP_${data.status}` : 'AUTH_UNAVAILABLE');
  let message = 'Не удалось подключить OneDrive. Проверьте настройки Microsoft-аккаунта или повторите подключение.';
  if (code === 'AADSTS50020' || code === 'unauthorized_client') message = 'Тип Microsoft-аккаунта не разрешён настройками приложения. Проверьте поддерживаемые аккаунты и authority в Microsoft Entra.';
  else if (code === 'AADSTS50011') message = 'Адрес возврата не совпадает с настройкой Web в Microsoft Entra. Проверьте redirect URI сервера.';
  else if (code === 'AADSTS700016') message = 'Microsoft не нашёл регистрацию приложения. Проверьте Application (client) ID сервера.';
  else if (['AADSTS7000215', 'AADSTS7000222', 'invalid_client'].includes(code)) message = 'Сервер OneDrive требует настройки: проверьте значение и срок действия Microsoft client secret.';
  else if (code === 'access_denied' || code === 'user_cancelled') message = 'Подключение OneDrive отменено. Вы можете повторить подключение.';
  else if (reconnectCodes.has(code)) message = 'Доступ Microsoft истёк или отозван. Повторите подключение OneDrive.';
  else if (code === 'OAUTH_NONCE_MISMATCH') message = 'Ответ Microsoft не прошёл проверку безопасности. Повторите подключение OneDrive.';
  else if (stage === 'graph_drive' && data.status === 404) message = 'OneDrive пока недоступен для этого аккаунта. Откройте OneDrive у Microsoft и затем повторите подключение.';
  else if (data.status === 403) message = 'Microsoft не разрешил доступ. Проверьте делегированные разрешения User.Read и Files.ReadWrite.';
  else if (stage === 'refresh') message = 'Не удалось обновить соединение с Microsoft. Повторите чтение позже; подключение сохранено.';
  return { code, stage, correlationId: crypto.randomUUID(), message };
}
export function requiresReconnect(diagnostic: AuthDiagnostic) { return reconnectCodes.has(diagnostic.code); }
type Configuration = { MICROSOFT_CLIENT_ID?: string; MICROSOFT_CLIENT_SECRET?: string; MICROSOFT_TENANT?: string; TOKEN_ENCRYPTION_KEY?: string; BRIDGE_URL?: string };
export function publicConfiguration(env: Configuration) {
  const issues: { code: string; message: string }[] = [];
  const clientId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(env.MICROSOFT_CLIENT_ID || '') ? env.MICROSOFT_CLIENT_ID : undefined;
  if (!clientId) issues.push({ code: 'CLIENT_ID_REQUIRED', message: 'Нужен Application (client) ID зарегистрированного приложения Play Your Life.' });
  else if (clientId.toLowerCase() === ENTRA_PORTAL_CLIENT_ID) issues.push({ code: 'ENTRA_PORTAL_CLIENT_ID', message: 'Указан ID портала Microsoft ADIbizaUX. Укажите ID собственного приложения Play Your Life.' });
  const tenant = env.MICROSOFT_TENANT || 'consumers';
  if (!['consumers', 'common'].includes(tenant)) issues.push({ code: 'PERSONAL_ACCOUNTS_DISABLED', message: 'Для личного OneDrive укажите consumers; для личных и рабочих аккаунтов — common и совместимую регистрацию Entra.' });
  let redirectUri: string | undefined;
  try {
    const url = new URL(env.BRIDGE_URL || '');
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) || url.origin !== env.BRIDGE_URL) throw new Error();
    redirectUri = `${url.origin}/callback`;
  } catch { issues.push({ code: 'BRIDGE_URL_REQUIRED', message: 'Укажите точный HTTPS-origin сервера OneDrive без пути и завершающего слеша.' }); }
  if (!env.MICROSOFT_CLIENT_SECRET) issues.push({ code: 'SERVER_SECRET_REQUIRED', message: 'Настройте Microsoft client secret в секретах сервера.' });
  if (!/^[a-f0-9]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY || '')) issues.push({ code: 'ENCRYPTION_KEY_REQUIRED', message: 'Настройте ключ шифрования токенов в секретах сервера.' });
  return { clientId, authority: ['consumers', 'common', 'organizations'].includes(tenant) ? `https://login.microsoftonline.com/${tenant}` : '', redirectUri, scopes, configured: !issues.length, issues };
}
