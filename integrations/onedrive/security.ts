export class DriveError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
function base64(bytes: Uint8Array) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 16384) text += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(text);
}
export async function seal(value: unknown, secret: string, owner: string): Promise<string> {
  const key = await encryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(owner) }, key, new TextEncoder().encode(JSON.stringify(value)));
  return `${base64(iv)}.${base64(new Uint8Array(encrypted))}`;
}
export async function unseal<T>(value: string, secret: string, owner: string): Promise<T> {
  const [iv, data] = value.split('.').map(part => Uint8Array.from(atob(part), c => c.charCodeAt(0)));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(owner) }, await encryptionKey(secret), data);
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
async function encryptionKey(secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new DriveError(503, 'Сервер OneDrive ещё не настроен.');
  const bytes = Uint8Array.from(secret.match(/../g)!, n => parseInt(n, 16));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
/** Never send a Firebase/Microsoft bearer to a caller-selected origin or Graph service. */
export function graphPath(value: string): string {
  const url = new URL(value.startsWith('/me/') || value.startsWith('/drives/') ? `/v1.0${value}` : value, 'https://graph.microsoft.com/v1.0/');
  if (url.origin !== 'https://graph.microsoft.com' || url.username || url.password || url.hash ||
    !/^\/v1\.0\/(me\/drive(?:\/|$)|drives\/[^/]+\/(?:items\/|root(?:\/|$)))/.test(url.pathname) || /%2f|%5c|\\/i.test(url.pathname))
    throw new DriveError(400, 'Недопустимый адрес OneDrive.');
  return url.href;
}
export function uploadUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
    !['.up.1drv.com', '.up.1drv.com.cn', '.sharepoint.com'].some(suffix => url.hostname.endsWith(suffix)))
    throw new DriveError(502, 'Microsoft вернул недопустимый адрес загрузки.');
  return url.href;
}
export function safeMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeMetadata);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !key.toLowerCase().includes('downloadurl') && key !== 'uploadUrl' && key !== 'thumbnails')
    .map(([key, item]) => [key, safeMetadata(item)]));
  return value;
}
export function errorMessage(status: number): string {
  return ({ 400: 'Проверьте название файла и параметры операции.', 401: 'Требуется повторное подключение OneDrive.',
    403: 'Нет доступа к файлу или папке.', 404: 'Файл удалён или перемещён.', 409: 'Такое имя уже занято или операция конфликтует с изменениями.',
    410: 'Сессия загрузки или синхронизации истекла. Обновите данные.', 412: 'Файл изменён на другом устройстве. Обновите список и повторите действие.', 413: 'Файл слишком большой для выбранного способа загрузки.',
    416: 'Часть файла уже загружена. Проверьте состояние загрузки.', 429: 'Превышен лимит запросов Microsoft. Повторите позже.',
    501: 'Операция не поддерживается этим аккаунтом Microsoft.', 507: 'Недостаточно места в OneDrive.' } as Record<number, string>)[status] || 'Microsoft OneDrive временно недоступен. Повторите позже.';
}
