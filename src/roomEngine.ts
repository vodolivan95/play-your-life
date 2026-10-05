import type { GameState } from './game.ts';
import { sphereProgress } from './sphereProgress.ts';

export type RoomId = 'health' | 'sport' | 'growth' | 'english' | 'finance' | 'together' | 'driving' | 'tasks' | 'hobby';
export type ObjectId = 'mat' | 'dumbbells' | 'bench' | 'ball' | 'plant' | 'treadmill';
export type Vec3 = [number, number, number];
export type RoomObject = { id: ObjectId; position: Vec3; rotation: Vec3; scale: Vec3 };
export type RoomData = { purchased: ObjectId[]; objects: RoomObject[] };
export type RoomConfig = { id: RoomId; title: string; size: [number, number]; catalog: readonly ObjectSpec[] };
export type ObjectSpec = { id: ObjectId; name: string; price: number; level: number; size: [number, number]; asset: string };

const sportCatalog: readonly ObjectSpec[] = [
  { id: 'mat', name: 'Коврик', price: 100, level: 1, size: [2, 1], asset: '/models/sport/mat.glb' },
  { id: 'dumbbells', name: 'Гантели', price: 180, level: 2, size: [1, 1], asset: '/models/sport/dumbbells.glb' },
  { id: 'bench', name: 'Скамья', price: 300, level: 4, size: [2, 1], asset: '/models/sport/bench.glb' },
  { id: 'ball', name: 'Фитбол', price: 140, level: 3, size: [1, 1], asset: '/models/sport/ball.glb' },
  { id: 'plant', name: 'Растение', price: 120, level: 1, size: [1, 1], asset: '/models/sport/plant.glb' },
  { id: 'treadmill', name: 'Беговая дорожка', price: 800, level: 18, size: [2, 3], asset: '/models/sport/treadmill.glb' },
];

export const roomConfigs: Record<RoomId, RoomConfig> = Object.fromEntries(
  (['health', 'sport', 'growth', 'english', 'finance', 'together', 'driving', 'tasks', 'hobby'] as const)
    .map(id => [id, { id, title: ({ health: 'Здоровье', sport: 'Спорт', growth: 'Саморазвитие', english: 'Английский', finance: 'Финансы', together: 'Общие дела', driving: 'Вождение', tasks: 'Задачи', hobby: 'Хобби' })[id], size: [12, 10], catalog: id === 'sport' ? sportCatalog : [] }]),
) as Record<RoomId, RoomConfig>;

export function roomData(state: GameState, id: RoomId): RoomData {
  return state.rooms?.[id] ?? { purchased: [], objects: [] };
}
export function objectSpec(id: ObjectId): ObjectSpec {
  const item = sportCatalog.find(item => item.id === id);
  if (!item) throw new Error('Предмет не найден.');
  return item;
}
export function rotateSize(size: [number, number], yaw: number): [number, number] {
  return Math.abs(Math.round(yaw / (Math.PI / 2))) % 2 ? [size[1], size[0]] : size;
}
export function placementValid(room: RoomData, candidate: RoomObject, roomId: RoomId): boolean {
  const cfg = roomConfigs[roomId];
  const spec = cfg.catalog.find(item => item.id === candidate.id);
  if (!spec || !candidate.position.every(Number.isFinite) || !candidate.rotation.every(Number.isFinite) || !candidate.scale.every(n => Number.isFinite(n) && n > 0)) return false;
  if (candidate.position[1] !== 0 || candidate.rotation[0] !== 0 || candidate.rotation[2] !== 0) return false;
  if (candidate.scale.some(n => n !== 1) || Math.abs(candidate.rotation[1] / (Math.PI / 2) - Math.round(candidate.rotation[1] / (Math.PI / 2))) > 1e-8) return false;
  const [x, , z] = candidate.position;
  if (!Number.isInteger(x) || !Number.isInteger(z) || x < -4 || x > 4 || z < -3 || z > 3) return false;
  const [w, d] = rotateSize(spec.size, candidate.rotation[1]);
  if (Math.abs(x) + w / 2 > cfg.size[0] / 2 - 1 || Math.abs(z) + d / 2 > cfg.size[1] / 2 - 1) return false;
  return room.objects.every(other => {
    if (other.id === candidate.id) return true;
    const otherSpec = cfg.catalog.find(item => item.id === other.id);
    if (!otherSpec) return false;
    const [ow, od] = rotateSize(otherSpec.size, other.rotation[1]);
    return Math.abs(x - other.position[0]) >= (w + ow) / 2 || Math.abs(z - other.position[2]) >= (d + od) / 2;
  });
}
function setRoom(state: GameState, id: RoomId, room: RoomData): GameState {
  return { ...state, rooms: { ...state.rooms, [id]: room } };
}
export function purchaseRoomObject(state: GameState, roomId: RoomId, id: ObjectId): GameState {
  const item = roomConfigs[roomId].catalog.find(item => item.id === id);
  if (!item) throw new Error('Предмет недоступен в этой комнате.');
  const room = roomData(state, roomId);
  if (room.purchased.includes(id)) throw new Error('Предмет уже куплен.');
  if (sphereProgress(state.spheres[roomId].xp).level < item.level) throw new Error(`Нужен уровень сферы ${item.level}.`);
  if (state.coins < item.price) throw new Error('Недостаточно монет.');
  return { ...setRoom(state, roomId, { ...room, purchased: [...room.purchased, id] }), coins: state.coins - item.price };
}
export function placeRoomObject(state: GameState, roomId: RoomId, object: RoomObject): GameState {
  const room = roomData(state, roomId);
  if (!room.purchased.includes(object.id)) throw new Error('Сначала купи предмет.');
  if (room.objects.some(item => item.id === object.id)) throw new Error('Предмет уже установлен.');
  if (!placementValid(room, object, roomId)) throw new Error('Место занято или недоступно.');
  return setRoom(state, roomId, { ...room, objects: [...room.objects, object] });
}
export function moveRoomObject(state: GameState, roomId: RoomId, object: RoomObject): GameState {
  const room = roomData(state, roomId);
  if (!room.objects.some(item => item.id === object.id)) throw new Error('Предмет не установлен.');
  const other = { ...room, objects: room.objects.filter(item => item.id !== object.id) };
  if (!placementValid(other, object, roomId)) throw new Error('Место занято или недоступно.');
  return setRoom(state, roomId, { ...room, objects: [...other.objects, object] });
}
export function removeRoomObject(state: GameState, roomId: RoomId, id: ObjectId): GameState {
  const room = roomData(state, roomId);
  return setRoom(state, roomId, { ...room, objects: room.objects.filter(item => item.id !== id) });
}
export function validRooms(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([id, data]) => {
    if (!Object.hasOwn(roomConfigs, id) || !data || typeof data !== 'object' || Array.isArray(data)) return false;
    const room = data as RoomData;
    const cfg = roomConfigs[id as RoomId];
    if (!Array.isArray(room.purchased) || !Array.isArray(room.objects)) return false;
    if (room.objects.some(item => !item || typeof item !== 'object')) return false;
    if (new Set(room.purchased).size !== room.purchased.length || new Set(room.objects.map(item => item.id)).size !== room.objects.length) return false;
    if (!room.purchased.every(item => cfg.catalog.some(spec => spec.id === item))) return false;
    const installed: RoomObject[] = [];
    for (const item of room.objects) {
      if (!item || !room.purchased.includes(item.id) || !Array.isArray(item.position) || item.position.length !== 3 || !Array.isArray(item.rotation) || item.rotation.length !== 3 || !Array.isArray(item.scale) || item.scale.length !== 3 || !placementValid({ ...room, objects: installed }, item, id as RoomId)) return false;
      installed.push(item);
    }
    return true;
  });
}
