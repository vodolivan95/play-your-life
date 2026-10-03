import player from '../assets/player.png';

export default function Avatar({ value }: { value: string }) {
  return value === 'character' ? (
    <img className="character-avatar" src={player} alt="" />
  ) : (
    <>{value}</>
  );
}
