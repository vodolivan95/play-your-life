/** Текущая погода в Люберцах от Open-Meteo: бесплатно, без ключа, прямо из браузера. */
export const weatherPoint = { lat: 55.669663, lon: 37.907137 };
export const weatherEndpoint =
  `https://api.open-meteo.com/v1/forecast?latitude=${weatherPoint.lat}&longitude=${weatherPoint.lon}` +
  '&current=temperature_2m,weather_code,is_day&timeformat=unixtime&timezone=Europe%2FMoscow';

export type LiveWeather = { temp: number; code: number; day: boolean; time: number };

/** Коды погоды WMO → значок и подпись. */
const codes: [number[], string, string][] = [
  [[0], '☀️', 'Ясно'],
  [[1], '🌤️', 'Малооблачно'],
  [[2], '⛅', 'Переменная облачность'],
  [[3], '☁️', 'Пасмурно'],
  [[45, 48], '🌫️', 'Туман'],
  [[51, 53, 55, 56, 57], '🌦️', 'Морось'],
  [[61, 63, 66], '🌧️', 'Дождь'],
  [[65, 67], '🌧️', 'Сильный дождь'],
  [[80, 81, 82], '🌧️', 'Ливень'],
  [[71, 73, 77], '🌨️', 'Снег'],
  [[75], '❄️', 'Сильный снег'],
  [[85, 86], '🌨️', 'Снегопад'],
  [[95], '⛈️', 'Гроза'],
  [[96, 99], '⛈️', 'Гроза с градом'],
];

export function describeWeather(code: number, day: boolean): { icon: string; label: string } {
  const found = codes.find(([list]) => list.includes(code));
  if (!found) return { icon: '🌡️', label: 'Погода' };
  const [, icon, label] = found;
  if (!day && code === 0) return { icon: '🌙', label };
  if (!day && (code === 1 || code === 2)) return { icon: '☁️', label };
  return { icon, label };
}

/** Проверяет ответ Open-Meteo; null — если данные неполные, странные или старше трёх часов. */
export function parseWeather(json: unknown, now = Date.now()): LiveWeather | null {
  const current = (json as { current?: Record<string, unknown> } | null)?.current;
  if (!current) return null;
  const temp = current.temperature_2m, code = current.weather_code, isDay = current.is_day, time = current.time;
  if (typeof temp !== 'number' || !Number.isFinite(temp) || temp < -90 || temp > 65) return null;
  if (typeof code !== 'number' || !codes.some(([list]) => list.includes(code))) return null;
  if (isDay !== 0 && isDay !== 1) return null;
  if (typeof time !== 'number' || Math.abs(now / 1000 - time) > 10800) return null;
  return { temp: Math.round(temp), code, day: isDay === 1, time };
}

export function formatTemp(temp: number) {
  return `${temp > 0 ? '+' : temp < 0 ? '−' : ''}${Math.abs(temp)}°`;
}
