import type { ObjectId, ObjectSpec, RoomData } from '../../roomEngine';
export default function Shop({ catalog, room, level, coins, onBuy }: { catalog: readonly ObjectSpec[]; room: RoomData; level: number; coins: number; onBuy: (id: ObjectId) => void }) {
  return <div className="room3d-catalog">{catalog.map(item => {
    const owned = room.purchased.includes(item.id), locked = level < item.level;
    return <article key={item.id}><div><h3>{item.name}</h3><p>LVL {item.level} · {item.price} Coins</p><p>{item.size[0]} × {item.size[1]} м</p></div>
      <button disabled={owned || locked || coins < item.price} onClick={() => onBuy(item.id)}>{owned ? 'Куплено' : locked ? `Нужен LVL ${item.level}` : 'Купить'}</button>
    </article>;
  })}</div>;
}
