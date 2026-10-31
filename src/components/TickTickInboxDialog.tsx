import { useContext, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { spheres } from '../game';
import type { GameState } from '../game';
import type { IncomingScope } from '../ticktickInbox';
import { TickTickContext } from '../tickTickContext';
import Icon from './Icon';
import TickTickConnection from './TickTickConnection';
import TickTickInbox from './TickTickInbox';
import './TickTickInboxDialog.css';

export function TickTickInboxContent({ state, onChange, scope }: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  scope: IncomingScope;
}) {
  const manager = useContext(TickTickContext);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const changed = () => setOnline(navigator.onLine);
    window.addEventListener('online', changed);
    window.addEventListener('offline', changed);
    return () => { window.removeEventListener('online', changed); window.removeEventListener('offline', changed); };
  }, []);
  const sphere = spheres.find((s) => s.id === scope.sphereId);
  const goal = state.goals.find((g) => g.id === scope.goalId && g.sphere === scope.sphereId);
  const stage = goal?.stages?.find((s) => s.id === scope.stageId);
  const active = Boolean(manager?.connection && manager.connected && state.profile.mode !== 'demo');
  const mapped = Boolean(manager?.connection?.sphereLists?.[scope.sphereId]);
  return <div className="ticktick-inbox-dialog-body">
    <h2>Разобрать входящие</h2>
    <p className="muted">{sphere?.name}{goal ? ` → ${goal.name}` : ''}{stage ? ` → ${stage.name}` : ''}</p>
    <p className="score-note">Выбери проект и этап этой сферы, затем нажми «Принять в игру». Задача останется связанной с TickTick; за импорт награда не начисляется.</p>
    {!online && state.profile.mode !== 'demo' && <p className="empty" role="status">Нет сети. Подключись к интернету, чтобы обновить и принять входящие TickTick.</p>}
    {!active && <p className="empty" role="status">{state.profile.mode === 'demo'
      ? 'В демо-игре входящие недоступны. Войди в личный аккаунт и подключи TickTick.'
      : manager?.busy ? 'Проверяем подключение TickTick…' : 'Подключи TickTick, чтобы разобрать входящие этой сферы.'}</p>}
    <TickTickInbox state={state} onChange={onChange} scope={scope} />
    {(!active || !mapped || !online) ? <TickTickConnection demo={state.profile.mode === 'demo'} /> : <details>
      <summary>Настройки подключения TickTick</summary>
      <TickTickConnection demo={false} />
    </details>}
  </div>;
}

export default function TickTickInboxDialog({ state, onChange, scope, onClose }: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  scope: IncomingScope;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const sphere = spheres.find((s) => s.id === scope.sphereId);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="ticktick-inbox-dialog" aria-label={`Разобрать входящие: ${sphere?.name ?? ''}`} onCancel={onClose}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="dialog-content">
      <button type="button" className="icon-button modal-close" aria-label="Закрыть" onClick={onClose} autoFocus><Icon name="close" /></button>
      <TickTickInboxContent state={state} onChange={onChange} scope={scope} />
    </div>
  </dialog>;
}
