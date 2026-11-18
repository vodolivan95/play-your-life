import carsUrl from '../assets/city-cars.webp';
import boatsUrl from '../assets/city-boats.webp';
import islandMapUrl from '../assets/city-islands.webp';
import knightUrl from '../assets/city-people/kaykit-knight.webp';
import barbarianUrl from '../assets/city-people/kaykit-barbarian.webp';
import mageUrl from '../assets/city-people/kaykit-mage.webp';
import rogueUrl from '../assets/city-people/kaykit-rogue.webp';
import hoodedUrl from '../assets/city-people/kaykit-hooded.webp';

// Подгрузка ресурсов «Города» (≈4,5 МБ) уже после того, как приложение открылось: через 12 с после
// полной загрузки страницы и в простое, чтобы не отнимать сеть у первого экрана. К открытию вкладки
// карта, машины, суда и жители обычно уже в кеше. Не качаем при экономии трафика и на 2G/3G.
let started = false;
export function preloadCityAssets(): void {
  if (started || typeof window === 'undefined') return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || /(^|-)[23]g$/.test(connection?.effectiveType ?? '')) return;
  started = true;
  const urls = [islandMapUrl, carsUrl, boatsUrl, knightUrl, barbarianUrl, mageUrl, rogueUrl, hoodedUrl];
  const run = () => urls.forEach((url, index) => window.setTimeout(() => { const img = new Image(); img.decoding = 'async'; img.src = url; }, index * 600));
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  const later = () => window.setTimeout(() => (idle ? idle(run, { timeout: 5000 }) : run()), 12000);
  if (document.readyState === 'complete') later(); else window.addEventListener('load', later, { once: true });
}
