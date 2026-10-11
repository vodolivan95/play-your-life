import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { GameState } from '../game';
import { buyItem, findShopItem, redeemPurchase, shopCatalog } from '../shop';
import type { ShopItem } from '../shop';
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
          ['owned', 'Мои'],
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
            .filter((i) => i.kind === tab)
            .map((i) => {
              const owned =
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
                    disabled={owned}
                    onClick={() => setSelected(i.id)}
                    aria-label={`${i.name}, ${i.price} монет`}
                  >
                    {owned
                      ? 'Уже твоя ✓'
                      : `🪙 ${i.price.toLocaleString('ru')}`}
                  </button>
                </article>
              );
            })}
        </div>
      ) : (
        <section className="shop-owned">
          <h2>Твои награды</h2>
          {!purchases.length && <p>Купленные награды появятся здесь.</p>}
          {purchases
            .slice()
            .reverse()
            .map((p) => {
              const i = findShopItem(state, p.itemId);
              if (!i) return null;
              return (
                <article className="panel owned-reward" key={p.id}>
                  {i.image ? <img className="owned-reward-photo" src={i.image} alt="" /> : <span aria-hidden="true">{i.icon}</span>}
                  <div>
                    <h3>{i.name}</h3>
                    <small>
                      {new Date(p.date).toLocaleDateString('ru')} · {p.price}{' '}
                      монет
                    </small>
                  </div>
                  <button
                    className="text-button"
                    disabled={!!p.usedAt || state.shop?.equippedFrame === i.id}
                    onClick={() => {
                      onChange(redeemPurchase(state, p.id));
                      notify(
                        i.kind === 'frame'
                          ? 'Рамка применена'
                          : 'Приятного отдыха!',
                      );
                    }}
                  >
                    {p.usedAt
                      ? 'Использовано ✓'
                      : i.kind === 'frame'
                        ? state.shop?.equippedFrame === i.id
                          ? 'Надета ✓'
                          : 'Надеть'
                        : 'Использовать'}
                  </button>
                </article>
              );
            })}
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
