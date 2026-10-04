import { cityLandmarks } from '../cityLandmarks';
import { useContext } from 'react';
import type { BuildingState } from '../city';
import { CityAppearanceContext } from '../cityAppearanceContext';
import cityImage from '../assets/life-city.webp';
import './CityBuildingArt.css';

const initial: BuildingState = { tier: 1, style: 'coastal', owned: [], slots: [null, null, null] };
function Palm({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y - 10})`}><ellipse cy="4" rx="10" ry="3" fill="#21524c30" /><path d="M0 3Q-3 -10 0 -22" fill="none" stroke="#94754b" strokeWidth="3" /><path d="M0 -22Q-13 -34 -17 -19Q-8 -25 0 -22Q13 -36 18 -22Q9 -27 0 -22Q-7 -40 -12 -31Q-6 -29 0 -22Q8 -41 13 -31Q6 -30 0 -22" fill="#318d63" /><path d="M0 -22L-9 -25M0 -22L10 -27" stroke="#71b76c" /></g>;
}
function Decor({ item, x, y }: { item: string; x: number; y: number }) {
  if (item === 'palm') return <Palm x={x} y={y} />;
  return <g transform={`translate(${x} ${y - 10})`}>
    <ellipse cy="3" rx="12" ry="4" fill="#1c51452a" />
    {item === 'bench' && <><path d="M-10 -5H10V0H-10Z" fill="#9c744b" /><path d="M-10 -10H10V-7H-10Z" fill="#b68c5c" /><path d="M-8 0V5M8 0V5" stroke="#47535d" strokeWidth="2" /></>}
    {item === 'flowers' && <><ellipse rx="12" ry="5" fill="#539263" />{[-7, 0, 7].map((a,i)=><g key={a} transform={`translate(${a} ${-2-i%2*2})`}><circle r="3.5" fill={i===1?'#f3c568':'#e68db3'} /><circle r="1" fill="#fff1b2" /></g>)}</>}
    {item === 'lamp' && <><path d="M0 3V-22" stroke="#445a69" strokeWidth="2.5" /><path d="M-4 -21L0 -27L4 -21V-16H-4Z" fill="#ffec9c" stroke="#526877" /><ellipse cy="-20" rx="8" ry="10" fill="#ffe690" opacity=".22" /></>}
    {item === 'fountain' && <><ellipse rx="13" ry="6" fill="#f6e9cc" /><ellipse cy="-1" rx="10" ry="4" fill="#6bd5e6" /><path d="M0 -1Q-8 -19 -9 -4M0 -1V-21M0 -1Q8 -19 9 -4" fill="none" stroke="#f2ffff" strokeWidth="1.8" /></>}
    {item === 'statue' && <><path d="M-7 2L0 -2L7 2V6H-7Z" fill="#ead7a5" /><path d="M-4 1V-13L0 -18L4 -13V1Z" fill="#e0c47f" /><circle cy="-21" r="4" fill="#f7df9c" /></>}
  </g>;
}
export default function CityBuildingArt({ id, building, variant = 'scene' }: { id: string; building?: BuildingState; variant?: 'scene' | 'icon' | 'map' }) {
  const city = useContext(CityAppearanceContext);
  const b = building ?? city?.buildings[id] ?? initial;
  const d = cityLandmarks[id];
  if (!d) return null;
  const x = (d.x - 15) * 9;
  const y = (d.y - 12) * 6;
  const gold = b.tier === 3;
  const trim = gold ? '#edc465' : '#c5edf2';
  return <svg className={`city-building-art ${variant === 'scene' ? 'sphere-building' : ''} building-art-${variant}`} viewBox={`${x} ${y} 270 165`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${d.name} · улучшение ${b.tier}/3`} data-sphere={id} data-tier={b.tier} data-style={b.style}>
    <image className={`building-source style-${b.style}`} href={cityImage} width="900" height="600" />
    {b.tier >= 2 && <g className="building-enhancements" transform={`translate(${x} ${y - 10})`}>
      <path d="M79 151L132 140L185 153L132 169Z" fill={gold?'#e8d6a4':'#e1edf0'} stroke={trim} strokeWidth="1.5" />
      <path d="M79 151V145L132 134L185 147V153M132 134V140M105 139V145M157 140V146" fill="none" stroke={gold?'#edc465':'#d3f7ff'} strokeWidth="1.6" />
      <path d="M98 121L135 113L168 123L134 133Z" fill={gold?'#e6bf62':'#83bac7'} opacity=".94" />
      <path d="M102 122V143M164 124V145" stroke={trim} strokeWidth="2.5" />
      <Palm x={57} y={153} /><Palm x={215} y={153} />
      {gold && <>{[87,183].map(a=><g key={a}><path d={`M${a} 157V126`} stroke="#8c7453" strokeWidth="2" /><circle cx={a} cy="125" r="3" fill="#ffe9a4" /><circle cx={a} cy="125" r="7" fill="#ffe9a4" opacity=".23" /></g>)}</>}
    </g>}
    {b.slots.map((item,i)=>item&&<Decor key={i} item={item} x={x+[45,135,228][i]} y={y+[151,158,152][i]} />)}
  </svg>;
}
