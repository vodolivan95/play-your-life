import player from '../assets/player.png';
import './Avatar.css';

export default function Avatar({
  value,
  frame,
}: {
  value: string;
  frame?: string;
}) {
  return (
    <span className={`avatar-content${frame ? ` frame-${frame}` : ''}`}>
      {value === 'character' || value === '🐼' ? (
        <img className="character-avatar" src={player} alt="" />
      ) : (
        value
      )}
    </span>
  );
}
