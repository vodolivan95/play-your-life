import type { ObjectId, ObjectSpec, RoomData, RoomObject } from '../../roomEngine';
export default function Inventory({ catalog, room, onPlace, onRemove }: { catalog: readonly ObjectSpec[]; room: RoomData; onPlace: (id: ObjectId, installed?: RoomObject) => void; onRemove: (id: ObjectId) => void }) {
  return <div className="room3d-catalog">{catalog.filter(item => room.purchased.includes(item.id)).map(item => {
    const installed = room.objects.find(object => object.id === item.id);
    return <article key={item.id}><div><h3>{item.name}</h3><p>{installed ? 'Установлен в комнате' : 'В инвентаре'}</p></div>
      <button onClick={() => onPlace(item.id, installed)}>{installed ? 'Переместить' : 'Установить'}</button>
      {installed && <button onClick={() => onRemove(item.id)}>Убрать</button>}
    </article>;
  })}{!room.purchased.length && <p>Пока пусто. Купи первый предмет в магазине.</p>}</div>;
}
