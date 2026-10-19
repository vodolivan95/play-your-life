import { isNativeApp } from '../platform';

/** Определение «слабого» устройства для живого города: телефон, планшет с касанием или мало памяти. Ширина экрана одна не годится (телефон в ландшафте, планшет). */
export function isConstrainedDevice(): boolean {
  if (typeof window==='undefined') return false;
  // Установленное приложение всегда на телефоне — не ждём порогов по ширине/памяти, экономим батарею и нагрев сразу.
  if (isNativeApp()) return true;
  const coarse=window.matchMedia?.('(pointer: coarse)').matches??false;
  const shortSide=Math.min(window.screen?.width||window.innerWidth,window.screen?.height||window.innerHeight);
  const memory=(navigator as Navigator&{deviceMemory?:number}).deviceMemory;
  return window.innerWidth<=760||(coarse&&shortSide<=1024)||(memory!==undefined&&memory<=2);
}
