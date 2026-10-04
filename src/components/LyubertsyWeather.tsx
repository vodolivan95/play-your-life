import { useEffect, useState } from 'react';
const forecast = 'https://yandex.ru/pogoda/ru/lubercy?lat=55.669663&lon=37.907137';
const conditions: Record<string, [string, string]> = {
  clear: ['☀️', 'Ясно'], 'partly-cloudy': ['⛅', 'Малооблачно'], cloudy: ['⛅', 'Облачно с прояснениями'], overcast: ['☁️', 'Пасмурно'],
  'light-rain': ['🌧️', 'Небольшой дождь'], rain: ['🌧️', 'Дождь'], 'heavy-rain': ['🌧️', 'Сильный дождь'], showers: ['🌧️', 'Ливень'],
  'wet-snow': ['🌨️', 'Дождь со снегом'], 'light-snow': ['🌨️', 'Небольшой снег'], snow: ['🌨️', 'Снег'], 'snow-showers': ['🌨️', 'Снегопад'], hail: ['🌨️', 'Град'],
  thunderstorm: ['⛈️', 'Гроза'], 'thunderstorm-with-rain': ['⛈️', 'Дождь с грозой'], 'thunderstorm-with-hail': ['⛈️', 'Гроза с градом'],
};
type Weather = { temp: number; condition: string; daytime: string; obs_time: number };
export default function YandexLyubertsyWeather() {
  const endpoint = import.meta.env.VITE_YANDEX_WEATHER_URL as string | undefined;
  const [weather, setWeather] = useState<Weather | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!endpoint) return;
    let active = true;
    let controller: AbortController;
    async function update() {
      controller?.abort();
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(endpoint!, { signal: controller.signal, credentials: 'omit' });
        if (!response.ok) throw new Error('weather');
        const { fact } = await response.json();
        if (!fact || !Number.isFinite(fact.temp) || fact.temp < -90 || fact.temp > 65 || !Object.hasOwn(conditions, fact.condition) || !['d', 'n'].includes(fact.daytime) || !Number.isFinite(fact.obs_time) || Math.abs(Date.now() / 1000 - fact.obs_time) > 10800) throw new Error('weather');
        if (active) { setWeather({ temp: fact.temp, condition: fact.condition, daytime: fact.daytime, obs_time: fact.obs_time }); setFailed(false); }
      } catch { if (active) setFailed(true); }
      finally { clearTimeout(timeout); }
    }
    void update();
    const interval = setInterval(() => void update(), 600000);
    return () => { active = false; clearInterval(interval); controller?.abort(); };
  }, [endpoint]);
  const [icon, label] = weather ? conditions[weather.condition] : ['☁️', endpoint ? failed ? 'Прогноз на Яндексе →' : 'Загрузка погоды…' : 'Открыть прогноз →'];
  return <a className="home-weather" href={forecast} target="_blank" rel="noreferrer" aria-label="Погода в Люберцах — Яндекс Погода" title={weather ? `Обновлено: ${new Date(weather.obs_time * 1000).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}` : 'Прогноз Яндекс Погоды для выбранной точки в Люберцах'}><span aria-hidden="true">{weather?.condition === 'clear' && weather.daytime === 'n' ? '🌙' : icon}</span><div><small>Люберцы, Россия</small><strong>{weather ? `${label} ${weather.temp > 0 ? '+' : ''}${weather.temp}°C` : label}</strong><span className="weather-source">Яндекс Погода{failed && weather ? ' · нет связи' : ''}</span></div></a>;
}
