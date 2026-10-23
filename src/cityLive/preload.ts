import carsUrl from '../assets/city-cars.webp';
import boatsUrl from '../assets/city-boats.webp';
import islandMapUrl from '../assets/city-islands.webp';
import knightUrl from '../assets/city-people/kaykit-knight.webp';
import barbarianUrl from '../assets/city-people/kaykit-barbarian.webp';
import mageUrl from '../assets/city-people/kaykit-mage.webp';
import rogueUrl from '../assets/city-people/kaykit-rogue.webp';
import hoodedUrl from '../assets/city-people/kaykit-hooded.webp';

// Подгрузка ресурсов «Города» в простое при запуске: к открытию вкладки карта, машины, суда и жители уже в кеше браузера.
// Не качаем при включённой экономии трафика и на медленной сети.
let started = false;
export function preloadCityAssets(): void {
  if (started || typeof window === 'undefined') return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '')) return;
  started = true;
  const urls = [islandMapUrl, carsUrl, boatsUrl, knightUrl, barbarianUrl, mageUrl, rogueUrl, hoodedUrl];
  const run = () => urls.forEach((url, index) => window.setTimeout(() => { const img = new Image(); img.decoding = 'async'; img.src = url; }, index * 250));
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(run, { timeout: 4000 }); else window.setTimeout(run, 2000);
}
