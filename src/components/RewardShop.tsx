import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { GameState } from '../game';
import { buyItem, findShopItem, redeemPurchase, shopCatalog } from '../shop';
import type { Purchase, ShopItem } from '../shop';
import { shopModelFile } from '../shopModels';
import Avatar from './Avatar';
import CustomRewardForm from './CustomRewardForm';
import './RewardShop.css';
import './RewardShopGlass.css';

const ShopModelViewer = lazy(() => import('./shop3d/ShopModelViewer'));
const modelUrl = (id: string) => {
  const file = shopModelFile(id);
  return file ? `${import.meta.env.BASE_URL}models/shop/${file}` : null;
};

type Tab = 'reward' | 'lux' | 'owned';
const TABS: [Tab, string][] = [
  ['reward', 'Награды'],
  ['lux', 'Награда Люкс'],
  ['owned', 'Мои награды'],
];

/** Золотой лайфкоин: цена и баланс. */
function Coin({ size = 24 }: { size?: number }) {
  return (
    <svg className="shop-coin-icon" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="shop-coin-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3bd" />
          <stop offset="0.5" stopColor="#ffc83a" />
          <stop offset="1" stopColor="#d98a0b" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#shop-coin-gradient)" stroke="#b36a00" strokeWidth="1" />
      <circle cx="16" cy="16" r="11" fill="none" stroke="#fff6cf" strokeOpacity="0.85" strokeWidth="1.4" />
      <path d="M16 7.5l2.2 6.3 6.3 2.2-6.3 2.2-2.2 6.3-2.2-6.3-6.3-2.2 6.3-2.2z" fill="#a85f00" />
      <path d="M8 11a10 10 0 0 1 8-5" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Звёзды считаются один раз на старте: одни и те же при каждом показе. */
const LUX_STARS = (() => {
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  return Array.from({ length: 90 }, (_, key) => ({
    key,
    left: `${(rnd() * 100).toFixed(1)}%`,
    top: `${(rnd() * 100).toFixed(1)}%`,
    size: [1.5, 2, 2, 3, 3, 4][Math.floor(rnd() * 6)],
    opacity: Number((0.35 + rnd() * 0.6).toFixed(2)),
    gold: rnd() < 0.2,
  }));
})();

/** Звёздное небо страницы «Награда Люкс». */
function LuxStars() {
  return (
    <div className="lux-stars" aria-hidden="true">
      {LUX_STARS.map((s) => (
        <span
          key={s.key}
          className={s.gold ? 'is-gold' : undefined}
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, opacity: s.opacity }}
        />
      ))}
      <svg className="lux-sparkle lux-sparkle-a" width="46" height="46" viewBox="0 0 24 24"><path d="M12 1l2.4 8.6L23 12l-8.6 2.4L12 23l-2.4-8.6L1 12l8.6-2.4z" fill="#ffe9a8" /></svg>
      <svg className="lux-sparkle lux-sparkle-b" width="28" height="28" viewBox="0 0 24 24"><path d="M12 1l2.4 8.6L23 12l-8.6 2.4L12 23l-2.4-8.6L1 12l8.6-2.4z" fill="#dfe8ff" /></svg>
    </div>
  );
}

export default function RewardShop({
  state,
  onChange,
  notify,
}: {
  state: GameState;
  onChange: (state: GameState) => void;
  notify: (message: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('reward');
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
  }, [selected]);
  const purchases = state.shop?.purchases ?? [];
  const item = selected ? findShopItem(state, selected) : undefined;
  const owned = purchases
    .slice()
    .reverse()
    .map((p) => ({ p, i: findShopItem(state, p.itemId) }))
    .filter((e): e is { p: Purchase; i: ShopItem } => !!e.i);
  const usedCount = owned.filter((e) => e.p.usedAt).length;
  const waitingCount = owned.filter((e) => e.i.kind === 'reward' && !e.p.usedAt).length;
  const kindLabel = (i: ShopItem) => i.lux ? 'Награда Люкс' : i.custom ? 'Своя награда' : i.kind === 'frame' ? 'Рамка аватара' : 'Награда в жизни';
  const kindClass = (i: ShopItem) => (i.lux ? ' is-lux' : i.custom ? ' is-custom' : '');
  const art = (i: ShopItem) => i.image ? <img className="shop-art-photo" src={i.image} alt="" /> : <span aria-hidden="true">{i.icon}</span>;
  const catalog = shopCatalog(state).filter((i) => i.kind === 'reward');
  const shown = catalog.filter((i) => (tab === 'lux' ? !!i.lux : !i.lux));
  function buy() {
    if (!item) return;
    try {
      onChange(buyItem(state, item.id));
      setSelected(null);
      notify('Награда теперь в разделе «Мои награды»!');
    } catch (error) {
      notify((error as Error).message);
    }
  }
  return (
    <div className={`reward-shop${tab === 'lux' ? ' is-lux-page' : ''}`}>
      {tab === 'lux' && <LuxStars />}
      <section className="shop-balance">
        <span className="shop-coin" aria-hidden="true">
          <Coin size={44} />
        </span>
        <div>
          <span>Баланс</span>
          <strong>{state.coins.toLocaleString('ru')}</strong>
          <small>Лайфкоины за выполненные задачи</small>
        </div>
      </section>
      <p className="shop-explanation">
        Зарабатывай в игре, отдыхай в жизни. Здесь тратятся только игровые
        лайфкоины. Реальные награды ты организуешь для себя сам.
      </p>
      <div className="tabs shop-tabs" aria-label="Разделы магазина">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            className={`${tab === id ? 'selected' : ''}${id === 'lux' ? ' is-lux-tab' : ''}`}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'lux' && (
        <header className="lux-header">
          <p className="lux-eyebrow">Самые дорогие награды</p>
          <h2 className="lux-title">Награда Люкс.</h2>
          <p className="lux-lead">Для тех, кто накопил на большее. Выбери награду, достойную твоих усилий.</p>
        </header>
      )}
      {tab !== 'owned' ? (
        <>
          <h2 className="shop-section-title">{tab === 'lux' ? 'Все награды Люкс' : 'Все награды'}</h2>
          <div className="shop-grid">
            <button type="button" className="shop-card shop-card-create" onClick={() => setEditing('new')}>
              <span className="shop-create-plus" aria-hidden="true">＋</span>
              <strong>Своя награда</strong>
              <span>Придумай награду, добавь картинку и назначь цену в лайфкоинах</span>
            </button>
            {shown.map((i) => {
              const missing = Math.max(0, i.price - state.coins);
              return (
                <article className={`shop-card${i.lux ? ' is-lux' : ''}`} key={i.id}>
                  <div className="shop-art">
                    {modelUrl(i.id) ? (
                      <>
                        <Suspense fallback={<span aria-hidden="true">{i.icon}</span>}>
                          <ShopModelViewer url={modelUrl(i.id)!} label={`3D-модель: ${i.name}`} fallback={i.icon} />
                        </Suspense>
                        <button type="button" className="shop-3d-open" onClick={() => setSelected(i.id)} aria-label={`Рассмотреть «${i.name}» в 3D`}>
                          3D
                        </button>
                      </>
                    ) : (
                      art(i)
                    )}
                    {i.custom && (
                      <button type="button" className="shop-3d-open shop-edit" onClick={() => setEditing(i.id)} aria-label={`Изменить награду «${i.name}»`}>
                        Изменить
                      </button>
                    )}
                  </div>
                  <span className={`shop-kind${kindClass(i)}`}>{kindLabel(i)}</span>
                  <h2>{i.name}</h2>
                  <p>{i.description}</p>
                  <button
                    className="shop-price"
                    onClick={() => setSelected(i.id)}
                    aria-label={`${i.name}, ${i.price} лайфкоинов`}
                  >
                    <Coin size={28} />
                    <span>{i.price.toLocaleString('ru')}</span>
                  </button>
                  {missing > 0 && (
                    <div className="shop-saving">
                      <div className="shop-saving-bar"><div style={{ width: `${Math.min(100, Math.round((state.coins / i.price) * 100))}%` }} /></div>
                      <span>Не хватает {missing.toLocaleString('ru')} лайфкоинов</span>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <section className="shop-owned" aria-labelledby="owned-title">
          <header className="owned-head">
            <p className="owned-eyebrow">Моя коллекция</p>
            <h2 id="owned-title">Мои награды</h2>
            <dl className="owned-stats">
              <div><dt>Получено</dt><dd>{owned.length}</dd></div>
              <div><dt>Использовано</dt><dd>{usedCount}</dd></div>
              <div><dt>Ждут тебя</dt><dd>{waitingCount}</dd></div>
            </dl>
          </header>
          {!owned.length && <p className="owned-empty">Купленные награды появятся здесь.</p>}
          <div className="shop-grid owned-grid">
            {owned.map(({ p, i }) => {
              const frame = i.kind === 'frame';
              const worn = state.shop?.equippedFrame === i.id;
              return (
                <article className={`shop-card owned-card${i.lux ? ' is-lux' : ''}`} key={p.id}>
                  <div className="shop-art">
                    {modelUrl(i.id) ? (
                      <Suspense fallback={<span aria-hidden="true">{i.icon}</span>}>
                        <ShopModelViewer url={modelUrl(i.id)!} label={`3D-модель: ${i.name}`} fallback={i.icon} />
                      </Suspense>
                    ) : frame ? (
                      <span className="shop-frame-preview">
                        <Avatar value={state.profile.avatar} photo={state.profile.photo} frame={i.id} />
                      </span>
                    ) : (
                      art(i)
                    )}
                  </div>
                  <span className={`shop-kind${kindClass(i)}`}>{kindLabel(i)}</span>
                  <h3>{i.name}</h3>
                  <p>{new Date(p.date).toLocaleDateString('ru')} · {p.price.toLocaleString('ru')} лайфкоинов</p>
                  <button
                    className="shop-price shop-use"
                    disabled={!!p.usedAt || worn}
                    onClick={() => {
                      onChange(redeemPurchase(state, p.id));
                      notify(frame ? 'Рамка применена' : 'Приятного отдыха!');
                    }}
                  >
                    {p.usedAt ? 'Использовано ✓' : frame ? (worn ? 'Надета ✓' : 'Надеть') : 'Использовать'}
                  </button>
                </article>
              );
            })}
          </div>
          {state.shop?.equippedFrame && (
            <button
              className="text-button"
              onClick={() =>
                onChange({
                  ...state,
                  shop: { ...state.shop!, equippedFrame: undefined },
                })
              }
            >
              Снять рамку
            </button>
          )}
        </section>
      )}
      {item && (
        <dialog
          ref={dialog}
          className="panel shop-confirm"
          aria-labelledby="shop-confirm-title"
          onCancel={() => setSelected(null)}
        >
          {modelUrl(item.id) ? (
            <Suspense fallback={<span className="shop-confirm-icon" aria-hidden="true">{item.icon}</span>}>
              <ShopModelViewer url={modelUrl(item.id)!} label={`3D-модель: ${item.name}. Поверни мышью, пальцем или кнопками ниже.`} fallback={item.icon} interactive />
            </Suspense>
          ) : item.image ? (
            <img className="shop-confirm-photo" src={item.image} alt="" />
          ) : (
            <span className="shop-confirm-icon" aria-hidden="true">
              {item.icon}
            </span>
          )}
          <h2 id="shop-confirm-title">{item.name}</h2>
          <p>
            Потратить {item.price} лайфкоинов? После покупки останется{' '}
            {Math.max(0, state.coins - item.price)}.
          </p>
          {state.coins < item.price && (
            <p>Не хватает {item.price - state.coins} лайфкоинов.</p>
          )}
          <button
            autoFocus
            className="primary-button"
            disabled={state.coins < item.price}
            onClick={buy}
          >
            Купить за {item.price} 🪙
          </button>
          <button className="text-button" onClick={() => setSelected(null)}>
            Отмена
          </button>
        </dialog>
      )}
      {editing && (
        <CustomRewardForm
          reward={editing === 'new' ? undefined : state.shop?.customRewards?.find((r) => r.id === editing)}
          defaultLux={tab === 'lux'}
          state={state}
          onChange={onChange}
          notify={notify}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
