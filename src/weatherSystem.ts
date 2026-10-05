export type WeatherKind = 'clear' | 'partlyCloudy' | 'cloudy' | 'rain' | 'thunderstorm' | 'fog' | 'snow';
export type CityTime = 'day' | 'sunset' | 'night';
export type WeatherParameters = { cloudiness: number; rainIntensity: number; snowIntensity: number; fogDensity: number; windStrength: number; sunIntensity: number; trafficSpeed: number; pedestrianDensity: number; wetness: number; snowAmount: number };
export const weatherLabels: Record<WeatherKind, string> = { clear: 'Ясно', partlyCloudy: 'Переменная облачность', cloudy: 'Облачно', rain: 'Дождь', thunderstorm: 'Гроза', fog: 'Туман', snow: 'Снег' };
export const weatherConfig: Record<WeatherKind, Omit<WeatherParameters, 'wetness' | 'snowAmount'>> = {
  clear: { cloudiness: 0, rainIntensity: 0, snowIntensity: 0, fogDensity: .003, windStrength: .1, sunIntensity: 2.4, trafficSpeed: 1, pedestrianDensity: 1 },
  partlyCloudy: { cloudiness: .4, rainIntensity: 0, snowIntensity: 0, fogDensity: .004, windStrength: .18, sunIntensity: 1.8, trafficSpeed: 1, pedestrianDensity: 1 },
  cloudy: { cloudiness: .85, rainIntensity: 0, snowIntensity: 0, fogDensity: .008, windStrength: .25, sunIntensity: .65, trafficSpeed: 1, pedestrianDensity: .9 },
  rain: { cloudiness: 1, rainIntensity: .65, snowIntensity: 0, fogDensity: .012, windStrength: .4, sunIntensity: .35, trafficSpeed: .8, pedestrianDensity: .45 },
  thunderstorm: { cloudiness: 1, rainIntensity: 1, snowIntensity: 0, fogDensity: .016, windStrength: .8, sunIntensity: .12, trafficSpeed: .65, pedestrianDensity: .2 },
  fog: { cloudiness: .65, rainIntensity: 0, snowIntensity: 0, fogDensity: .045, windStrength: .12, sunIntensity: .45, trafficSpeed: .7, pedestrianDensity: .65 },
  snow: { cloudiness: .85, rainIntensity: 0, snowIntensity: .85, fogDensity: .016, windStrength: .3, sunIntensity: .6, trafficSpeed: .75, pedestrianDensity: .65 },
};
export function initialWeather(): WeatherParameters { return { ...weatherConfig.clear, wetness: 0, snowAmount: 0 }; }
export function advanceWeather(current: WeatherParameters, kind: WeatherKind, seconds: number): WeatherParameters {
  const dt = Math.max(0, Math.min(seconds, 1));
  const target = weatherConfig[kind];
  const next = { ...current };
  const mix = 1 - Math.exp(-dt / 5);
  for (const key of Object.keys(target) as Array<keyof typeof target>) {
    // Clouds and dimmer sunlight precede precipitation, including CLEAR → RAIN.
    const value = (key === 'rainIntensity' || key === 'snowIntensity') && current.cloudiness < .65 ? 0 : target[key];
    next[key] += (value - next[key]) * mix;
  }
  next.wetness = Math.max(0, Math.min(1, current.wetness + dt * (next.rainIntensity * .035 - (next.rainIntensity < .05 ? .003 : 0))));
  next.snowAmount = Math.max(0, Math.min(1, current.snowAmount + dt * (next.snowIntensity * .012 - (next.snowIntensity < .05 ? .001 : 0))));
  return next;
}
export function automaticTime(hour: number): CityTime { return hour >= 7 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'sunset' : 'night'; }
export function automaticWeather(minutes: number): WeatherKind { return (['clear', 'partlyCloudy', 'cloudy', 'rain', 'fog', 'clear', 'snow', 'thunderstorm'] as WeatherKind[])[Math.floor(minutes / 5) % 8]; }
