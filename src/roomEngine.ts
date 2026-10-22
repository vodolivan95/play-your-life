import type { GameState } from './game.ts';
import { sphereProgress } from './sphereProgress.ts';

export type RoomId = 'health' | 'sport' | 'growth' | 'english' | 'finance' | 'together' | 'driving' | 'tasks' | 'hobby' | 'psychology';
export type ObjectId = 'mat' | 'dumbbells' | 'bench' | 'ball' | 'plant' | 'treadmill'
  | 'bookshelf' | 'desk' | 'armchair' | 'floorLamp' | 'globe' | 'board'
  | 'massageTable' | 'waterCooler' | 'smoothieBar' | 'firstAid' | 'aquarium' | 'cedarBarrel'
  | 'tradingDesk' | 'safe' | 'sofa' | 'piggyBank' | 'bullStatue' | 'goldChest'
  | 'phoneBooth' | 'teaTable' | 'studyDesk' | 'chesterfield' | 'busModel' | 'bigBen'
  | 'carSimulator' | 'trafficLight' | 'tireStack' | 'toolCart' | 'motorcycle' | 'sportsCar'
  | 'diningTable' | 'gameTable' | 'beanBags' | 'karaoke' | 'pingPong' | 'fireplace'
  | 'easel' | 'guitar' | 'potteryWheel' | 'craftTable' | 'piano' | 'telescope'
  | 'standingDesk' | 'kanbanBoard' | 'hourglass' | 'filingCabinet' | 'trophyCase' | 'gong'
  | 'kettlebells' | 'dumbbell-rack' | 'exercise-bike' | 'boxing-bag' | 'power-rack'
  | 'therapyCouch' | 'loungeChair' | 'mindLibrary' | 'moodBoard' | 'sandTray' | 'singingBowl';
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
  { id: 'kettlebells', name: 'Гири', price: 150, level: 5, size: [1, 1], asset: '/models/sport/kettlebells.glb' },
  { id: 'dumbbell-rack', name: 'Стойка с гантелями', price: 400, level: 8, size: [2, 1], asset: '/models/sport/dumbbell-rack.glb' },
  { id: 'exercise-bike', name: 'Велотренажёр', price: 650, level: 12, size: [1, 2], asset: '/models/sport/exercise-bike.glb' },
  { id: 'boxing-bag', name: 'Боксёрская груша', price: 500, level: 15, size: [1, 1], asset: '/models/sport/boxing-bag.glb' },
  { id: 'treadmill', name: 'Беговая дорожка', price: 800, level: 18, size: [2, 3], asset: '/models/sport/treadmill.glb' },
  { id: 'power-rack', name: 'Силовая рама', price: 1200, level: 30, size: [2, 2], asset: '/models/sport/power-rack.glb' },
];
// Саморазвитие (ключ сохранений `growth`) — кабинет-библиотека; пол для мебели 11 × 9 м, по краям стеллажи. Первые четыре предмета доступны сразу, с 0 уровня новой сферы.
const growthCatalog: readonly ObjectSpec[] = [
  { id: 'bookshelf', name: 'Книжный шкаф', price: 150, level: 0, size: [2, 1], asset: '/models/growth/bookshelf.glb' },
  { id: 'desk', name: 'Письменный стол', price: 200, level: 0, size: [2, 1], asset: '/models/growth/desk.glb' },
  { id: 'armchair', name: 'Кресло для чтения', price: 160, level: 0, size: [1, 1], asset: '/models/growth/armchair.glb' },
  { id: 'floorLamp', name: 'Торшер', price: 90, level: 0, size: [1, 1], asset: '/models/growth/floor-lamp.glb' },
  { id: 'globe', name: 'Глобус', price: 220, level: 3, size: [1, 1], asset: '/models/growth/globe.glb' },
  { id: 'board', name: 'Доска идей', price: 260, level: 5, size: [2, 1], asset: '/models/growth/board.glb' },
];
// Здоровье — светлый велнес-центр: зелёная стена и полки с травами по краям, пол для мебели 11 × 9 м.
const healthCatalog: readonly ObjectSpec[] = [
  { id: 'massageTable', name: 'Массажный стол', price: 150, level: 0, size: [2, 1], asset: '/models/health/massage-table.glb' },
  { id: 'waterCooler', name: 'Кулер с водой', price: 80, level: 0, size: [1, 1], asset: '/models/health/water-cooler.glb' },
  { id: 'smoothieBar', name: 'Смузи-бар', price: 200, level: 0, size: [2, 1], asset: '/models/health/smoothie-bar.glb' },
  { id: 'firstAid', name: 'Аптечка', price: 120, level: 0, size: [1, 1], asset: '/models/health/first-aid.glb' },
  { id: 'aquarium', name: 'Аквариум', price: 260, level: 3, size: [2, 1], asset: '/models/health/aquarium.glb' },
  { id: 'cedarBarrel', name: 'Кедровая фитобочка', price: 300, level: 5, size: [1, 1], asset: '/models/health/cedar-barrel.glb' },
];
// Финансы — лаунж инвестора: экран с графиком и витрины с золотом по краям, пол для мебели 11 × 9 м.
const financeCatalog: readonly ObjectSpec[] = [
  { id: 'tradingDesk', name: 'Стол трейдера', price: 220, level: 0, size: [2, 1], asset: '/models/finance/trading-desk.glb' },
  { id: 'safe', name: 'Сейф', price: 180, level: 0, size: [1, 1], asset: '/models/finance/safe.glb' },
  { id: 'sofa', name: 'Кожаный диван', price: 200, level: 0, size: [2, 1], asset: '/models/finance/sofa.glb' },
  { id: 'piggyBank', name: 'Копилка', price: 60, level: 0, size: [1, 1], asset: '/models/finance/piggy-bank.glb' },
  { id: 'bullStatue', name: 'Бронзовый бык', price: 280, level: 3, size: [2, 1], asset: '/models/finance/bull.glb' },
  { id: 'goldChest', name: 'Сундук с золотом', price: 350, level: 5, size: [1, 1], asset: '/models/finance/gold-chest.glb' },
];
// Английский — лондонский языковой клуб: карта мира с часами столиц и полка словарей по краям.
const englishCatalog: readonly ObjectSpec[] = [
  { id: 'phoneBooth', name: 'Телефонная будка', price: 250, level: 0, size: [1, 1], asset: '/models/english/phone-booth.glb' },
  { id: 'teaTable', name: 'Столик для чая', price: 120, level: 0, size: [1, 1], asset: '/models/english/tea-table.glb' },
  { id: 'studyDesk', name: 'Парта с наушниками', price: 150, level: 0, size: [2, 1], asset: '/models/english/study-desk.glb' },
  { id: 'chesterfield', name: 'Кресло-честерфилд', price: 160, level: 0, size: [1, 1], asset: '/models/english/chesterfield.glb' },
  { id: 'busModel', name: 'Модель даблдекера', price: 260, level: 3, size: [2, 1], asset: '/models/english/bus.glb' },
  { id: 'bigBen', name: 'Модель Биг-Бена', price: 320, level: 5, size: [1, 1], asset: '/models/english/big-ben.glb' },
];
// Вождение — автошкола-гараж: перфопанель со знаками и стеллаж шин по краям.
const drivingCatalog: readonly ObjectSpec[] = [
  { id: 'carSimulator', name: 'Автосимулятор', price: 200, level: 0, size: [2, 1], asset: '/models/driving/simulator.glb' },
  { id: 'trafficLight', name: 'Светофор', price: 90, level: 0, size: [1, 1], asset: '/models/driving/traffic-light.glb' },
  { id: 'tireStack', name: 'Стопка шин', price: 70, level: 0, size: [1, 1], asset: '/models/driving/tires.glb' },
  { id: 'toolCart', name: 'Тележка с инструментами', price: 110, level: 0, size: [1, 1], asset: '/models/driving/tool-cart.glb' },
  { id: 'motorcycle', name: 'Мотоцикл', price: 300, level: 3, size: [2, 1], asset: '/models/driving/motorcycle.glb' },
  { id: 'sportsCar', name: 'Спорткар', price: 450, level: 5, size: [2, 3], asset: '/models/driving/sports-car.glb' },
];
// Общие дела — семейная гостиная: фотостена с гирляндой и кухонная стойка по краям.
const togetherCatalog: readonly ObjectSpec[] = [
  { id: 'diningTable', name: 'Обеденный стол', price: 200, level: 0, size: [2, 1], asset: '/models/together/dining-table.glb' },
  { id: 'gameTable', name: 'Столик для настолок', price: 100, level: 0, size: [1, 1], asset: '/models/together/game-table.glb' },
  { id: 'beanBags', name: 'Кресла-мешки', price: 120, level: 0, size: [2, 1], asset: '/models/together/bean-bags.glb' },
  { id: 'karaoke', name: 'Караоке-стойка', price: 150, level: 0, size: [1, 1], asset: '/models/together/karaoke.glb' },
  { id: 'pingPong', name: 'Теннисный стол', price: 300, level: 3, size: [2, 3], asset: '/models/together/ping-pong.glb' },
  { id: 'fireplace', name: 'Камин', price: 380, level: 5, size: [2, 1], asset: '/models/together/fireplace.glb' },
];
// Хобби — творческая мастерская: галерея картин и винил, полки с красками и пряжей по краям.
const hobbyCatalog: readonly ObjectSpec[] = [
  { id: 'easel', name: 'Мольберт', price: 120, level: 0, size: [1, 1], asset: '/models/hobby/easel.glb' },
  { id: 'guitar', name: 'Гитара на стойке', price: 140, level: 0, size: [1, 1], asset: '/models/hobby/guitar.glb' },
  { id: 'potteryWheel', name: 'Гончарный круг', price: 160, level: 0, size: [1, 1], asset: '/models/hobby/pottery-wheel.glb' },
  { id: 'craftTable', name: 'Стол для рукоделия', price: 180, level: 0, size: [2, 1], asset: '/models/hobby/craft-table.glb' },
  { id: 'piano', name: 'Пианино', price: 350, level: 3, size: [2, 1], asset: '/models/hobby/piano.glb' },
  { id: 'telescope', name: 'Телескоп', price: 300, level: 5, size: [1, 1], asset: '/models/hobby/telescope.glb' },
];
// Задачи — штаб продуктивности: канбан-доска с календарём и шкафчики с кубками по краям.
const tasksCatalog: readonly ObjectSpec[] = [
  { id: 'standingDesk', name: 'Стол для работы стоя', price: 180, level: 0, size: [2, 1], asset: '/models/tasks/standing-desk.glb' },
  { id: 'kanbanBoard', name: 'Мобильная канбан-доска', price: 140, level: 0, size: [2, 1], asset: '/models/tasks/kanban.glb' },
  { id: 'hourglass', name: 'Песочные часы-помодоро', price: 90, level: 0, size: [1, 1], asset: '/models/tasks/hourglass.glb' },
  { id: 'filingCabinet', name: 'Картотека', price: 110, level: 0, size: [1, 1], asset: '/models/tasks/filing-cabinet.glb' },
  { id: 'trophyCase', name: 'Витрина с наградами', price: 280, level: 3, size: [2, 1], asset: '/models/tasks/trophy-case.glb' },
  { id: 'gong', name: 'Гонг завершения', price: 320, level: 5, size: [1, 1], asset: '/models/tasks/gong.glb' },
];
// Психология — кабинет психолога: тёплый ковёр, книжная полка и доска настроения по краям, пол для мебели 11 × 9 м.
const psychologyCatalog: readonly ObjectSpec[] = [
  { id: 'therapyCouch', name: 'Кушетка для сессий', price: 180, level: 0, size: [2, 1], asset: '/models/psychology/therapy-couch.glb' },
  { id: 'loungeChair', name: 'Кресло для разговора', price: 150, level: 0, size: [1, 1], asset: '/models/psychology/lounge-chair.glb' },
  { id: 'mindLibrary', name: 'Книжная полка', price: 140, level: 0, size: [2, 1], asset: '/models/psychology/mind-library.glb' },
  { id: 'moodBoard', name: 'Доска настроения', price: 110, level: 0, size: [1, 1], asset: '/models/psychology/mood-board.glb' },
  { id: 'sandTray', name: 'Песочница для терапии', price: 260, level: 3, size: [1, 1], asset: '/models/psychology/sand-tray.glb' },
  { id: 'singingBowl', name: 'Поющая чаша', price: 180, level: 5, size: [1, 1], asset: '/models/psychology/singing-bowl.glb' },
];
const catalogs: Partial<Record<RoomId, readonly ObjectSpec[]>> = { sport: sportCatalog, growth: growthCatalog, health: healthCatalog, finance: financeCatalog, english: englishCatalog, driving: drivingCatalog, together: togetherCatalog, hobby: hobbyCatalog, tasks: tasksCatalog, psychology: psychologyCatalog };

export const roomConfigs: Record<RoomId, RoomConfig> = Object.fromEntries(
  (['health', 'sport', 'growth', 'english', 'finance', 'together', 'driving', 'tasks', 'hobby', 'psychology'] as const)
    .map(id => [id, { id, title: ({ health: 'Здоровье', sport: 'Спорт', growth: 'Саморазвитие', english: 'Английский', finance: 'Финансы', together: 'Общие дела', driving: 'Вождение', tasks: 'Задачи', hobby: 'Хобби', psychology: 'Психология' })[id], size: id === 'sport' ? [12, 10] : [11, 9], catalog: catalogs[id] ?? [] }]),
) as Record<RoomId, RoomConfig>;

/** Есть ли у сферы наполненный 3D-интерьер (каталог предметов). */
export function hasRoom(id: string): id is RoomId {
  return Object.hasOwn(roomConfigs, id) && roomConfigs[id as RoomId].catalog.length > 0;
}
export function roomData(state: GameState, id: RoomId): RoomData {
  return state.rooms?.[id] ?? { purchased: [], objects: [] };
}
export function objectSpec(id: ObjectId): ObjectSpec {
  const item = [sportCatalog, growthCatalog, healthCatalog, financeCatalog, englishCatalog, drivingCatalog, togetherCatalog, hobbyCatalog, tasksCatalog, psychologyCatalog].flat().find(item => item.id === id);
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
  if (!Number.isInteger(x * 2) || !Number.isInteger(z * 2)) return false;
  const [w, d] = rotateSize(spec.size, candidate.rotation[1]);
  if (Math.abs(x) + w / 2 > cfg.size[0] / 2 - .35 || Math.abs(z) + d / 2 > cfg.size[1] / 2 - .35) return false;
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
  if (state.coins < item.price) throw new Error('Недостаточно лайфкоинов.');
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
