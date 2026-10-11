import type { CSSProperties } from 'react';
import fox0 from '../assets/city-animals/fox-0.webp';
import fox8 from '../assets/city-animals/fox-8.webp';
import horse0 from '../assets/city-animals/horse-0.webp';
import horse8 from '../assets/city-animals/horse-8.webp';
import parrot0 from '../assets/city-animals/parrot-0.webp';
import parrot10 from '../assets/city-animals/parrot-10.webp';
import stork2 from '../assets/city-animals/stork-2.webp';
import stork8 from '../assets/city-animals/stork-8.webp';

// Анимированные 3D-модели (лиса — glTF Sample Assets, лошадь и птицы — примеры three.js),
// отрисованные под углом карты: 8 кадров шага или взмаха в строке. Координаты — карта 1005 × 1280.
type Animal = { sprite: string; from: [number, number]; to: [number, number]; size: number; walk: number; step: number; fly?: boolean };
const animals: Animal[] = [
  { sprite: fox0, from: [723, 551], to: [907, 585], size: 2.6, walk: 16, step: .55 },
  { sprite: fox8, from: [624, 934], to: [417, 928], size: 2.4, walk: 18, step: .55 },
  { sprite: horse0, from: [619, 786], to: [885, 794], size: 3.4, walk: 20, step: .6 },
  { sprite: horse8, from: [876, 379], to: [688, 359], size: 3.2, walk: 17, step: .6 },
  { sprite: fox0, from: [132, 537], to: [282, 558], size: 2.4, walk: 13, step: .55 },
  { sprite: fox8, from: [971, 1082], to: [783, 1033], size: 2.4, walk: 15, step: .55 },
  { sprite: parrot0, from: [-40, 260], to: [1040, 160], size: 3.6, walk: 16, step: .5, fly: true },
  { sprite: parrot10, from: [1040, 860], to: [520, 300], size: 3.4, walk: 14, step: .5, fly: true },
  { sprite: stork8, from: [1050, 120], to: [-60, 230], size: 4.4, walk: 24, step: .65, fly: true },
  { sprite: stork2, from: [-60, 560], to: [560, 1180], size: 4.2, walk: 20, step: .65, fly: true },
];
const percent = ([x, y]: [number, number]) => [`${(x / 1005) * 100}%`, `${(y / 1280) * 100}%`];

export default function CityAnimals() {
  return (
    <div className="city-animals" aria-hidden="true">
      {animals.map((a, i) => {
        const [x1, y1] = percent(a.from), [x2, y2] = percent(a.to);
        return <span key={i} className={a.fly ? 'city-animal is-flying' : 'city-animal'} style={{
          '--x1': x1, '--y1': y1, '--x2': x2, '--y2': y2, width: `${a.size}%`, backgroundImage: `url(${a.sprite})`,
          animationDuration: `${a.walk}s, ${a.step}s`, animationDelay: `-${(i * 3.7) % a.walk}s, 0s`,
        } as CSSProperties} />;
      })}
    </div>
  );
}
