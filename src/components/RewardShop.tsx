import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { GameState } from '../game';
import { buyItem, findShopItem, LUX_REWARD_ID, redeemPurchase, shopCatalog } from '../shop';
import type { Purchase, ShopItem } from '../shop';
import { shopModelFile } from '../shopModels';
import Avatar from './Avatar';
import CustomRewardForm from './CustomRewardForm';
import './RewardShop.css';

const ShopModelViewer = lazy(() => import('./shop3d/ShopModelViewer'));
const modelUrl = (id: string) => {
  const file = shopModelFile(id);
  return file ? `${import.meta.env.BASE_URL}models/shop/${file}` : null;
};

export default function RewardShop({
  state,
  onChange,
  notify,
}: {
  state: GameState;
  onChange: (state: GameState) => void;
  notify: (message: string) => void;
}) {
  const [tab, setTab] = useState('reward');
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
  }, [selected]);
  const purchases = state.shop?.purchases ?? [];
  const item = selected ? findShopItem(state, selected) : undefined;
  const lux = findShopItem(state, LUX_REWARD_ID);
  const luxCount = purchases.filter((p) => p.itemId === LUX_REWARD_ID).length;
  const owned = purchases
    .slice()
    .reverse()
    .map((p) => ({ p, i: findShopItem(state, p.itemId) }))
    .filter((e): e is { p: Purchase; i: ShopItem } => !!e.i);
  const usedCount = owned.filter((e) => e.p.usedAt).length;
  const waitingCount = owned.filter((e) => e.i.kind === 'reward' && !e.p.usedAt).length;
  const kindLabel = (i: ShopItem) => i.custom ? 'Своя награда' : i.kind === 'frame' ? 'Рамка аватара' : 'Награда в жизни';
  const art = (i: ShopItem) => i.image ? <img className="shop-art-photo" src={i.image} alt="" /> : <span aria-hidden="true">{i.icon}</span>;
  function buy() {
    if (!item) return;
    try {
      onChange(buyItem(state, item.id));
      setSelected(null);
      notify('Награда теперь в разделе «Мои»!');
    } catch (error) {
      notify((error as Error).message);
    }
  }
  return (
    <div className="reward-shop">
      <section className="shop-balance">
        <span className="shop-coin" aria-hidden="true">
          ✦
        </span>
        <div>
          <span>Баланс</span>
          <strong>{state.coins.toLocaleString('ru')}</strong>
          <small>Монеты за выполненные квесты</small>
        </div>
      </section>
      <p className="shop-explanation">
        Зарабатывай в игре, отдыхай в жизни. Здесь тратятся только игровые
        монеты. Реальные награды ты организуешь для себя сам.
      </p>
      <div className="tabs shop-tabs" aria-label="Разделы магазина">
        {[
          ['reward', 'Награды'],
          ['frame', 'Образ'],
          ['owned', 'Мои награды'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? 'selected' : ''}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'reward' && lux && (
        <section className="lux-hero" aria-labelledby="lux-title">
          <p className="lux-eyebrow">Главная награда</p>
          <h2 id="lux-title" className="lux-title">{lux.name}</h2>
          <p className="lux-lead">{lux.description}</p>
          <div className="lux-actions">
            <button type="button" className="lux-buy" onClick={() => setSelected(lux.id)} aria-label={`${lux.name}, ${lux.price} монет`}>
              Получить · 🪙 {lux.price.toLocaleString('ru')}
            </button>
            {luxCount > 0 && <span className="lux-note">Уже получена: {luxCount}</span>}
          </div>
        </section>
      )}
      {tab !== 'owned' ? (
        <div className="shop-grid">
          {tab === 'reward' && (
            <button type="button" className="shop-card shop-card-create" onClick={() => setEditing('new')}>
              <span className="shop-create-plus" aria-hidden="true">＋</span>
              <strong>Своя награда</strong>
              <span>Придумай награду, добавь картинку и назначь цену в монетах</span>
            </button>
          )}
          {shopCatalog(state)
            .filter((i) => i.kind === tab && i.id !== LUX_REWARD_ID)
            .map((i) => {
              const have =
                i.kind === 'frame' && purchases.some((p) => p.itemId === i.id);
              return (
                <article className="shop-card" key={i.id}>
                  <div className="shop-art">
                    {i.kind === 'frame' ? (
                      <span className="shop-frame-preview">
                        <Avatar value={state.profile.avatar} photo={state.profile.photo} frame={i.id} />
                      </span>
                    ) : modelUrl(i.id) ? (
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
                      <button type="button" className="shop-3d-open" onClick={() => setEditing(i.id)} aria-label={`Изменить награду «${i.name}»`}>
                        Изменить
                      </button>
                    )}
                  </div>
                  <span className={`shop-kind${i.custom ? ' is-custom' : ''}`}>{kindLabel(i)}</span>
                  <h2>{i.name}</h2>
                  <p>{i.description}</p>
                  <button
                    className="shop-price"
                    disabled={have}
                    onClick={() => setSelected(i.id)}
                    aria-label={`${i.name}, ${i.price} монет`}
                  >
                    {have
                      ? 'Уже твоя ✓'
                      : `🪙 ${i.price.toLocaleString('ru')}`}
                  </button>
                </article>
              );
            })}
        </div>
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
          {owned.filter(({ i }) => i.id === LUX_REWARD_ID).map(({ p, i }) => (
            <article className="lux-owned" key={p.id}>
              <p className="lux-eyebrow">Награда Люкс</p>
              <h3>{i.name}</h3>
              <p className="lux-lead">{i.description}</p>
              <small>{new Date(p.date).toLocaleDateString('ru')} · {p.price.toLocaleString('ru')} монет</small>
              <button
                type="button"
                className="lux-buy"
                disabled={!!p.usedAt}
                onClick={() => {
                  onChange(redeemPurchase(state, p.id));
                  notify('Приятного отдыха!');
                }}
              >
                {p.usedAt ? 'Использовано ✓' : 'Использовать'}
              </button>
            </article>
          ))}
          <div className="shop-grid owned-grid">
            {owned.filter(({ i }) => i.id !== LUX_REWARD_ID).map(({ p, i }) => {
              const frame = i.kind === 'frame';
              const worn = state.shop?.equippedFrame === i.id;
              return (
                <article className="shop-card owned-card" key={p.id}>
                  <div className="shop-art">{art(i)}</div>
                  <span className={`shop-kind${i.custom ? ' is-custom' : ''}`}>{kindLabel(i)}</span>
                  <h3>{i.name}</h3>
                  <p>{new Date(p.date).toLocaleDateString('ru')} · {p.price.toLocaleString('ru')} монет</p>
                  <button
                    className="shop-price"
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
            Потратить {item.price} монет? После покупки останется{' '}
            {Math.max(0, state.coins - item.price)}.
          </p>
          {state.coins < item.price && (
            <p>Не хватает {item.price - state.coins} монет.</p>
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
          state={state}
          onChange={onChange}
          notify={notify}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
