import type { CSSProperties } from 'react';
import soldier from '../assets/city-people/soldier.webp';
import red from '../assets/city-people/red.webp';
import blue from '../assets/city-people/blue.webp';
import yellow from '../assets/city-people/yellow.webp';
import green from '../assets/city-people/green.webp';
import white from '../assets/city-people/white.webp';
import orange from '../assets/city-people/orange.webp';
import pink from '../assets/city-people/pink.webp';
import dark from '../assets/city-people/dark.webp';

// Пешеходы — анимированные 3D-модели (Soldier и X Bot из примеров three.js), отрисованные под углом карты:
// атлас 8 × 8 — строки направления через 45° (0 — вправо, по часовой), столбцы — кадры шага.
// Маршруты — тротуары и площади цельной картинки-сцены, координаты в пикселях сцены 1440 × 900.
const looks = [soldier, red, blue, yellow, green, white, orange, pink, dark];
const routes: [number, number, number, number][] = [
  [810, 290, 880, 275], [690, 488, 840, 488], [735, 372, 830, 352], [495, 470, 590, 460], [955, 446, 1050, 452],
  [880, 616, 1000, 612], [720, 760, 860, 758], [885, 790, 950, 780], [700, 258, 722, 300], [600, 300, 660, 320],
];
const walkers = routes.flatMap(([x1, y1, x2, y2], i) => [[x1, y1, x2, y2], [x2, y2, x1, y1]].map(([a, b, c, d], j) => {
  const n = i * 2 + j, angle = (Math.atan2(d - b, c - a) * 180 / Math.PI + 360) % 360, row = Math.round(angle / 45) % 8;
  const walk = Math.hypot(c - a, d - b) / 9;
  return { n, look: looks[n % looks.length], from: [a, b], to: [c, d], row, walk };
}));
const pct = (x: number, y: number) => [`${(x / 1440) * 100}%`, `${(y / 900) * 100}%`];

export default function CityPeople() {
  return (
    <div className="city-people" aria-hidden="true">
      {walkers.map(w => {
        const [x1, y1] = pct(w.from[0], w.from[1]), [x2, y2] = pct(w.to[0], w.to[1]);
        return <span key={w.n} className="city-person" style={{
          '--x1': x1, '--y1': y1, '--x2': x2, '--y2': y2, width: '1.05%', backgroundImage: `url(${w.look})`,
          backgroundPositionY: `${(w.row / 7) * 100}%`, animationDuration: `${w.walk.toFixed(1)}s, .9s`,
          animationDelay: `-${((w.n * 2.3) % w.walk).toFixed(1)}s, -${((w.n * .13) % .9).toFixed(2)}s`,
        } as CSSProperties} />;
      })}
    </div>
  );
}
