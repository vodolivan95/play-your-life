import player from '../assets/player.png';
import './Avatar.css';

export default function Avatar({
  value,
  frame,
  photo,
}: {
  value: string;
  frame?: string;
  photo?: string;
}) {
  return (
    <span className={`avatar-content${frame ? ` frame-${frame}` : ''}`}>
      {photo ? (
        <img className="photo-avatar" src={photo} alt="" />
      ) : value === 'character' || value === '🐼' ? (
        <img className="character-avatar" src={player} alt="" />
      ) : (
        value
      )}
    </span>
  );
}
