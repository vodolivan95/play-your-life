import { useEffect, useState } from 'react';
type Weather = { temperature: number; code: number; day: boolean; time: string };
function description(code: number, day: boolean) {
  if (code === 0) return [day ? '☀️' : '🌙', day ? 'Ясно' : 'Ясная ночь'];
  if (code <= 3) return ['⛅', code === 3 ? 'Пасмурно' : 'Переменная облачность'];
  if (code <= 48) return ['🌫️', 'Туман'];
  if (code >= 71 && code <= 77 || code === 85 || code === 86) return ['🌨️', 'Снег'];
  if (code >= 95) return ['⛈️', 'Гроза'];
  return ['🌧️', 'Дождь'];
}
export default function LyubertsyWeather() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let controller: AbortController;
    let timeout: ReturnType<typeof setTimeout>;
    async function update() {
      controller?.abort();
      controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=55.677&longitude=37.893&current=temperature_2m,weather_code,is_day&timezone=Europe%2FMoscow&forecast_days=1', { signal: controller.signal });
        if (!response.ok) throw new Error('weather');
        const { current } = await response.json();
        if (!current || !Number.isFinite(current.temperature_2m) || !Number.isFinite(current.weather_code) || typeof current.time !== 'string' || ![0, 1].includes(current.is_day)) throw new Error('weather');
        if (active) { setWeather({ temperature: current.temperature_2m, code: current.weather_code, day: current.is_day === 1, time: current.time }); setFailed(false); }
      } catch { if (active) setFailed(true); }
      finally { clearTimeout(timeout); }
    }
    void update();
    const interval = setInterval(() => void update(), 600000);
    return () => { active = false; clearInterval(interval); clearTimeout(timeout); controller?.abort(); };
  }, []);
  const [icon, label] = weather ? description(weather.code, weather.day) : ['☁️', failed ? 'Погода недоступна' : 'Загрузка погоды…'];
  return <div className="home-weather" aria-label="Погода в Люберцах" title={weather ? `Обновлено: ${weather.time}, Москва` : undefined}><span aria-hidden="true">{icon}</span><div><small>Люберцы, Россия</small><strong>{weather ? `${label} ${weather.temperature > 0 ? '+' : ''}${Math.round(weather.temperature)}°C` : label}</strong><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo{failed && weather ? ' · нет связи' : ''}</a></div></div>;
}
