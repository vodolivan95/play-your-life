import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../game';
import { buyItem, shopItems, redeemPurchase } from '../shop';
import Avatar from './Avatar';
import './RewardShop.css';

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
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
  }, [selected]);
  const purchases = state.shop?.purchases ?? [];
  const item = shopItems.find((i) => i.id === selected);
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
          {shopItems
            .filter((i) => i.kind === tab)
            .map((i) => {
              const owned =
                i.kind === 'frame' && purchases.some((p) => p.itemId === i.id);
              return (
                <article className="shop-card" key={i.id}>
                  <div
                    className="shop-art"
                    style={{
                      background: `linear-gradient(145deg, ${i.color}, #fff)`,
                    }}
                  >
                    {i.kind === 'frame' ? (
                      <span className="shop-frame-preview">
                        <Avatar value={state.profile.avatar} frame={i.id} />
                      </span>
                    ) : (
                      <span aria-hidden="true">{i.icon}</span>
                    )}
                  </div>
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
              const i = shopItems.find((i) => i.id === p.itemId)!;
              return (
                <article className="panel owned-reward" key={p.id}>
                  <span aria-hidden="true">{i.icon}</span>
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
          <span className="shop-confirm-icon" aria-hidden="true">
            {item.icon}
          </span>
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
    </div>
  );
}
