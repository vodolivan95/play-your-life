import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { GameState } from '../game';
import { MAX_CUSTOM_REWARD_PRICE, removeCustomReward, saveCustomReward } from '../shop';
import type { CustomReward } from '../shop';
import { readProjectImage } from '../projectImage';

/** Окно создания и изменения своей награды: название, описание, картинка и цена. */
export default function CustomRewardForm({ reward, state, onChange, notify, onClose, defaultLux = false }: {
  reward?: CustomReward;
  defaultLux?: boolean;
  state: GameState;
  onChange: (state: GameState) => void;
  notify: (message: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(reward?.name ?? '');
  const [description, setDescription] = useState(reward?.description ?? '');
  const [price, setPrice] = useState(String(reward?.price ?? 100));
  const [image, setImage] = useState<string | undefined>(reward?.image);
  const [lux, setLux] = useState(reward?.lux ?? defaultLux);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bought = !!reward && (state.shop?.purchases ?? []).some((p) => p.itemId === reward.id);
  useEffect(() => { dialog.current?.showModal(); }, []);
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      onChange(saveCustomReward(state, { id: reward?.id, name, description, price: Number(price), image, lux }));
      notify(reward ? 'Награда обновлена' : lux ? 'Награда добавлена в «Награду Люкс»' : 'Своя награда добавлена в магазин');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function pick(input: HTMLInputElement) {
    const chosen = input.files?.[0];
    input.value = '';
    if (!chosen) return;
    setBusy(true); setError('');
    try { setImage(await readProjectImage(chosen)); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  function remove() {
    if (!reward) return;
    onChange(removeCustomReward(state, reward.id));
    notify(bought ? 'Награда убрана из витрины. Покупки остались во вкладке «Мои».' : 'Награда удалена');
    onClose();
  }
  return (
    <dialog ref={dialog} className="panel shop-confirm custom-reward-form" aria-labelledby="custom-reward-title" onCancel={onClose}>
      <form onSubmit={submit}>
        <h2 id="custom-reward-title">{reward ? 'Изменить награду' : 'Своя награда'}</h2>
        <div className="custom-reward-image">
          <span className="custom-reward-preview">
            {image ? <img src={image} alt="Картинка награды" /> : <span aria-hidden="true">🎁</span>}
          </span>
          <div>
            <button type="button" className="secondary-button" disabled={busy} onClick={() => file.current?.click()}>
              {busy ? 'Подготовка картинки…' : image ? 'Заменить картинку' : 'Выбрать картинку'}
            </button>
            {image && <button type="button" className="text-button" onClick={() => setImage(undefined)}>Убрать картинку</button>}
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void pick(e.currentTarget)} />
          </div>
        </div>
        <label>
          Название
          <input value={name} maxLength={60} required placeholder="Например, поход в кино с друзьями" onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Описание <small>необязательно</small>
          <textarea value={description} maxLength={200} rows={2} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label>
          Цена в монетах
          <input type="number" inputMode="numeric" min={1} max={MAX_CUSTOM_REWARD_PRICE} step={1} required value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label className="custom-reward-lux">
          <input type="checkbox" checked={lux} onChange={(e) => setLux(e.target.checked)} />
          <span>Награда Люкс — для самых дорогих наград, отдельный раздел магазина</span>
        </label>
        {bought && <p className="custom-reward-note">Новая цена действует для следующих покупок. Прежние покупки не меняются.</p>}
        {error && <p role="alert" className="custom-reward-error">{error}</p>}
        <button type="submit" className="primary-button" disabled={busy}>{reward ? 'Сохранить' : 'Добавить в магазин'}</button>
        {reward && (confirmDelete ? (
          <div className="custom-reward-delete">
            <span>{bought ? 'Убрать из витрины? Покупки останутся в «Моих».' : 'Удалить награду?'}</span>
            <button type="button" className="text-button danger" onClick={remove}>{bought ? 'Убрать' : 'Удалить'}</button>
            <button type="button" className="text-button" onClick={() => setConfirmDelete(false)}>Нет</button>
          </div>
        ) : (
          <button type="button" className="text-button" onClick={() => setConfirmDelete(true)}>{bought ? 'Убрать из витрины' : 'Удалить награду'}</button>
        ))}
        <button type="button" className="text-button" onClick={onClose}>Отмена</button>
      </form>
    </dialog>
  );
}
