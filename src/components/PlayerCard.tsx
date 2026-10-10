import type { CSSProperties } from 'react';
import type { GameState } from '../game';
import { playerProgress } from '../game';
import Avatar from './Avatar';

/** Карточка игрока в боковом меню и в шторке «Ещё»: аватар с кольцом уровня, имя, титул, XP и монеты. */
export default function PlayerCard({ state }: { state: GameState }) {
  const player = playerProgress(state);
  const personal = state.profile.mode === 'personal';
  const xpNow = personal ? state.xp % 200 : state.xp;
  const xpNext = personal ? 200 : player.nextXP;
  return (
    <div className="pyl-player">
      <div className="pyl-player-top">
        <span className="pyl-ring" style={{ '--p': Math.round(Math.min(100, Math.max(0, player.progress))) } as CSSProperties}>
          <span className="pyl-avatar">
            <Avatar value={state.profile.avatar} photo={state.profile.photo} frame={state.shop?.equippedFrame} />
          </span>
          <b className="pyl-level" aria-label={`Уровень ${player.level}`}>{player.level}</b>
        </span>
        <span className="pyl-player-name">
          <strong>{state.profile.name}</strong>
          <small>{player.title}</small>
        </span>
      </div>
      <div className="pyl-xp" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, player.progress))}%` }} /></div>
      <div className="pyl-player-meta">
        <span>{player.maxed ? `${state.xp} XP · максимум` : `${xpNow} / ${xpNext} XP`}</span>
        <span>Life Coins {state.coins}</span>
      </div>
    </div>
  );
}
