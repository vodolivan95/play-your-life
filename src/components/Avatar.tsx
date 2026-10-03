import player from '../assets/player.png';
import './Avatar.css';

export default function Avatar({ value }: { value: string }) {
  return (
    <span className="avatar-content">
      {value === 'character' || value === '🐼' ? (
        <img className="character-avatar" src={player} alt="" />
      ) : (
        value
      )}
    </span>
  );
}
