/** Определение «слабого» устройства для живого города: телефон, планшет с касанием или мало памяти. Ширина экрана одна не годится (телефон в ландшафте, планшет). */
export function isConstrainedDevice(): boolean {
  if (typeof window==='undefined') return false;
  const coarse=window.matchMedia?.('(pointer: coarse)').matches??false;
  const shortSide=Math.min(window.screen?.width||window.innerWidth,window.screen?.height||window.innerHeight);
  const memory=(navigator as Navigator&{deviceMemory?:number}).deviceMemory;
  return window.innerWidth<=760||(coarse&&shortSide<=1024)||(memory!==undefined&&memory<=2);
}
