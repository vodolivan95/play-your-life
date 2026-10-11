import { useEffect, useState } from 'react';
import { describeWeather, formatTemp, parseWeather, weatherEndpoint } from '../liveWeather';
import type { LiveWeather } from '../liveWeather';

const forecast = 'https://yandex.ru/pogoda/ru/lubercy?lat=55.669663&lon=37.907137';

/** Погода в Люберцах: градусы и значок обновляются каждые 10 минут, по нажатию — прогноз Яндекс Погоды. */
export default function YandexLyubertsyWeather() {
  const [weather, setWeather] = useState<LiveWeather | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    async function update() {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      const timeout = setTimeout(() => current.abort(), 10000);
      try {
        const response = await fetch(weatherEndpoint, { signal: current.signal, credentials: 'omit' });
        if (!response.ok) throw new Error('weather');
        const next = parseWeather(await response.json());
        if (!next) throw new Error('weather');
        if (active) { setWeather(next); setFailed(false); }
      } catch {
        if (active) setFailed(true);
      } finally {
        clearTimeout(timeout);
      }
    }
    void update();
    const interval = setInterval(() => void update(), 600000);
    const wake = () => { if (document.visibilityState === 'visible') void update(); };
    document.addEventListener('visibilitychange', wake);
    return () => { active = false; clearInterval(interval); document.removeEventListener('visibilitychange', wake); controller?.abort(); };
  }, []);
  const view = weather ? describeWeather(weather.code, weather.day) : null;
  const updated = weather ? new Date(weather.time * 1000).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <a
      className="home-weather"
      href={forecast}
      target="_blank"
      rel="noreferrer"
      aria-label={weather && view ? `Погода в Люберцах: ${view.label}, ${formatTemp(weather.temp)}. Открыть прогноз Яндекс Погоды` : 'Погода в Люберцах — Яндекс Погода'}
      title={weather ? `Обновлено в ${updated} · данные Open-Meteo · нажми, чтобы открыть прогноз Яндекс Погоды` : 'Прогноз Яндекс Погоды для Люберец'}
    >
      <span aria-hidden="true" className="home-weather-icon">{view ? view.icon : '☁️'}</span>
      <div>
        <small>Люберцы, Россия</small>
        {weather && view
          ? <strong><b className="home-weather-temp">{formatTemp(weather.temp)}</b> {view.label}</strong>
          : <strong>{failed ? 'Открыть прогноз →' : 'Загрузка погоды…'}</strong>}
        <span className="weather-source">{weather ? `Open-Meteo · Яндекс Погода →${failed ? ' · нет связи' : ''}` : 'Яндекс Погода'}</span>
      </div>
    </a>
  );
}
