import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { GameState } from '../game';
import { spheres } from '../game';
import { buyCityUpgrade, cityBalance, cityPrices, cityRooms } from '../city';
import './LivingBuilding.css';

export default function LivingBuilding({ state, id, onChange }: { state: GameState; id: string; onChange: (state: GameState) => void }) {
  const [message, setMessage] = useState('');
  const room = cityRooms[id];
  const sphere = spheres.find((s) => s.id === id)!;
  const owned = (slot: number) => (state.cityPurchases ?? []).some((p) => p.sphere === id && p.slot === slot);
  const level = 1 + [0, 1, 2].filter(owned).length;
  function buy(slot: number) {
    try {
      onChange(buyCityUpgrade(state, id, slot));
      setMessage(room.items[slot] + ' — установлено!');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось купить улучшение.');
    }
  }
  return (
    <section className="living-building" style={{ '--room-accent': sphere.color } as CSSProperties} aria-label={room.name}>
      <header className="living-heading">
        <div><span className="living-eyebrow">ТВОЙ ЖИВОЙ ГОРОД</span><h2>{room.name}</h2><p>{room.activity} · Уровень {level}</p></div>
        <div className="living-wallet"><strong>✦ {cityBalance(state)}</strong><span>жетонов развития</span></div>
      </header>
      <div className="living-scene" role="img" aria-label={room.name + ': жители гуляют, купленные улучшения появляются в комнате'}>
        <svg viewBox="0 0 800 420" aria-hidden="true">
          <rect width="800" height="420" rx="24" fill="#d8eff8"/>
          <circle cx="702" cy="47" r="30" fill="#fff3bf"/>
          <path d="M55 280L400 162L745 280L400 413Z" fill="#94bdae"/>
          <path d="M55 80L400 0V162L55 280Z" fill="#fff3dc"/>
          <path d="M400 0L745 80V280L400 162Z" fill="#e2eedc"/>
          <path d="M55 80L400 0L745 80" fill="none" stroke="white" strokeWidth="10"/>
          <path d="M75 280L400 172L725 280L400 397Z" fill="#dfc6a3"/>
          <path d="M160 253L492 363M269 216L613 322M180 318L517 208M289 360L623 244" stroke="#f5e5cc" strokeWidth="2"/>
          <path d="M55 280L400 162L745 280" fill="none" stroke="var(--room-accent)" strokeWidth="6"/>
          <path d="M515 68L664 109V218L515 172Z" fill="#94d9e6" stroke="white" strokeWidth="8"/>
          <path d="M588 88V195M515 118L664 159" stroke="white" strokeWidth="4"/>
          <path d="M519 171L563 116L602 170L631 149L662 216Z" fill="#82bbaa"/>
          <path d="M123 103L241 70V169L123 211Z" fill="var(--room-accent)"/>
          <text x="169" y="150" fontSize="40">{sphere.icon}</text>
          <ellipse cx="408" cy="316" rx="95" ry="26" fill="#8f785f" opacity=".15"/>
          <path d="M374 300V261L431 248V286Z" fill="#ab795b"/>
          <path d="M361 262L406 245L445 259L397 278Z" fill="#f7e6cb"/>
          <path d="M374 300V322M431 286V307" stroke="#86654e" strokeWidth="6"/>
          {[96, 706].map((x) => <g key={x}><path d={`M${x-13} 280h26l-4 25h-18Z`} fill="#d39973"/><ellipse cx={x} cy="267" rx="23" ry="24" fill="#5dab80"/></g>)}
        </svg>
        <span className="living-room-sign">{room.name}</span>
        {[0, 1, 2].map((slot) => <div key={slot} className={`living-furniture furniture-${slot} ${owned(slot) ? 'is-owned' : ''}`}><span>{owned(slot) ? room.icons[slot] : '＋'}</span><small>{owned(slot) ? room.items[slot] : 'Место для улучшения'}</small></div>)}
        {Array.from({ length: 3 + level }, (_, i) => <div key={i} className={`living-resident resident-${i % 3}`} style={{ '--resident-delay': `-${i * 3}s`, '--resident-color': ['#e58979', '#6c9bd0', '#a38aca', '#57ad91'][i % 4], '--resident-offset': `${i * 12}px` } as CSSProperties}><span className="resident-head"/><span className="resident-body"/><span className="resident-legs"/></div>)}
        <div className="living-scene-caption">● {3 + level} жителей · {level === 1 ? 'Здание открыто' : 'Здание развивается'}</div>
      </div>
      <p className="living-explainer">Реальные дела оживляют город: выполненная задача приносит 10 жетонов, завершённый проект — 100. Жетоны можно тратить в любом здании.</p>
      <div className="living-upgrades">{room.items.map((name, slot) => <article key={name}><span className="living-item-icon">{room.icons[slot]}</span><h3>{name}</h3><p>{['Новый уютный уголок', 'Больше занятий для жителей', 'Особая гордость района'][slot]}</p><button type="button" disabled={owned(slot) || cityBalance(state) < cityPrices[slot]} onClick={() => buy(slot)}>{owned(slot) ? '✓ Установлено' : `Купить · ✦ ${cityPrices[slot]}`}</button></article>)}</div>
      <p className="living-feedback" role="status">{message || 'Выбирай улучшение: оно сразу появится внутри здания.'}</p>
    </section>
  );
}
