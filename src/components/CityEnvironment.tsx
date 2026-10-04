import { useEffect, useRef } from 'react';
import './CityEnvironment.css';

// Coordinates match the island artwork. Routes stay on roads and coastal water.
const road = [[307, 120], [292, 208], [275, 316], [247, 370], [606, 370], [629, 276], [634, 210], [613, 156], [634, 210], [292, 208], [307, 120]];
const coast = [[65, 535], [180, 578], [440, 586], [680, 580], [854, 523], [880, 399], [890, 222], [869, 104], [808, 55], [551, 40], [335, 39], [65, 60], [20, 220], [24, 400], [65, 535]];
const walks = [[160, 353], [232, 358], [283, 348], [311, 375], [437, 386], [530, 380], [602, 369], [700, 367], [779, 357], [816, 372], [700, 367], [602, 369], [530, 380], [437, 386], [311, 375], [283, 348], [232, 358], [160, 353]];
function position(route: number[][], distance: number) {
  const lengths = route.slice(1).map((p, i) => Math.hypot(p[0] - route[i][0], p[1] - route[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  let remaining = ((distance % total) + total) % total;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) {
      const [x, y] = route[i];
      const [nx, ny] = route[i + 1];
      const fraction = remaining / lengths[i];
      return `translate(${x + (nx - x) * fraction} ${y + (ny - y) * fraction}) rotate(${Math.atan2(ny - y, nx - x) * 180 / Math.PI})`;
    }
    remaining -= lengths[i];
  }
  return '';
}
export default function CityEnvironment({ paused, speed }: { paused: boolean; speed: number }) {
  const root = useRef<SVGSVGElement>(null);
  const elapsed = useRef(0);
  useEffect(() => {
    if (paused) return;
    let frame = 0;
    let previous = 0;
    const tick = (time: number) => {
      if (previous) elapsed.current += Math.min(time - previous, 100) * speed / 1000;
      previous = time;
      root.current?.querySelectorAll<SVGGElement>('[data-agent]').forEach((node) => {
        const kind = node.dataset.agent;
        const index = Number(node.dataset.index);
        const route = kind === 'boat' ? coast : kind === 'person' ? walks : road;
        const velocity = kind === 'boat' ? 8 : kind === 'person' ? 5 : 19;
        node.setAttribute('transform', position(route, elapsed.current * velocity + index * (kind === 'person' ? 61 : 199)));
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, speed]);
  return <svg className="city-environment" ref={root} viewBox="0 0 900 600" aria-hidden="true">
    <defs><filter id="city-agent-shadow"><feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity=".35" /></filter></defs>
    {[0, 1, 2, 3].map(i => <g key={`boat-${i}`} data-agent="boat" data-index={i} transform={position(coast, i * 199)}>
      <path className="city-wake" d="M-10 -3 Q-30 -8 -40 -6 M-10 3 Q-30 8 -40 6" fill="none" stroke="white" strokeWidth="1" opacity=".6" />
      <g filter="url(#city-agent-shadow)"><path d="M-11 -4 Q8 -6 15 0 Q8 6 -11 4Z" fill="#fcfdff" /><rect x="-4" y="-2.5" width="10" height="5" rx="1" fill="#447b9b" /><path d="M-3 -1 L6 -1" stroke="#a9e5ff" /></g>
    </g>)}
    {Array.from({ length: 10 }, (_, i) => <g key={`car-${i}`} data-agent="car" data-index={i} transform={position(road, i * 199)} filter="url(#city-agent-shadow)"><rect x="-6" y="-3" width="12" height="6" rx="2" fill={['#ecbd55', '#3978b5', '#f6f5eb', '#cf6255'][i % 4]} /><rect x="-2" y="-2" width="5" height="4" rx="1" fill="#21445e" /><path d="M5 -2V2" stroke="#fff5c8" /></g>)}
    {Array.from({ length: 22 }, (_, i) => <g key={`person-${i}`} data-agent="person" data-index={i} transform={position(walks, i * 61)}><ellipse cx="0" cy="2" rx="2" ry="1" fill="#173a4c44" /><path d="M-1 1L-2 3M1 1L2 3" stroke="#29465d" strokeWidth=".8" /><ellipse rx="1.8" ry="1.2" fill={['#e0785e', '#e4bf61', '#4775b6', '#fbf8e4'][i % 4]} /><circle r="1" fill="#bd8866" /></g>)}
    {[[227, 329], [466, 365], [752, 340], [471, 538], [804, 540]].map(([x, y], i) => <g key={i} transform={`translate(${x} ${y})`} className="city-fountain"><ellipse className="city-ripple" rx="11" ry="4" fill="none" stroke="#c9f8ff" strokeWidth="1.2" /><path className="city-spray" d="M0 0Q-8 -20 -10 -4M0 0Q0 -25 0 -7M0 0Q8 -20 10 -4" fill="none" stroke="#f1feff" strokeWidth="1.2" opacity=".75" /></g>)}
    <g className="city-cloud" opacity=".1" fill="white"><ellipse cx="110" cy="90" rx="90" ry="30" /><ellipse cx="185" cy="72" rx="55" ry="25" /></g>
    <g className="city-night-lights" fill="#ffda82">{[[145,150],[430,169],[745,153],[183,304],[458,312],[764,300],[152,470],[459,475],[770,467]].map(([x,y],i)=><g key={i}><ellipse cx={x} cy={y} rx="26" ry="12" opacity=".16" /><circle cx={x} cy={y} r="2" /></g>)}</g>
  </svg>;
}
