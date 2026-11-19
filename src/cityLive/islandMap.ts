// Островная карта «Города» (0.89.15): новая иллюстрация 1672 × 941 px — двенадцать зданий сфер
// (включая «Совместные задачи», «Карьеру и бизнес», «Семью и отношения») вокруг центрального глобуса.
// Все точки сняты в пикселях этой картинки и хранятся нормализованными (0..1),
// эффекты (вода, огни, блики) — в пикселях профиля шириной ISLAND_WIDTH.
import type { CityProfile, CityRoute, Fountain, Point } from './paths.ts';

export const ISLAND_WIDTH = 2000;
/** Точные пропорции новой карты острова. */
export const ISLAND_IMAGE_WIDTH = 1672;
export const ISLAND_IMAGE_HEIGHT = 941;
export const ISLAND_HEIGHT = ISLAND_WIDTH * ISLAND_IMAGE_HEIGHT / ISLAND_IMAGE_WIDTH;

const imagePoint = (x: number, y: number): Point => ({ x: x / ISLAND_IMAGE_WIDTH, y: y / ISLAND_IMAGE_HEIGHT });
/** Пиксели картинки → пиксели профиля. */
const s = (value: number) => value * ISLAND_WIDTH / ISLAND_IMAGE_WIDTH;
const xy = (x: number, y: number): [number, number] => [s(x), s(y)];
const area = (points: number[][]): number[][] => points.map(([x, y]) => xy(x, y));
const imageRoute = (id: string, kind: CityRoute['kind'], points: number[][], speed: number, capacity: number): CityRoute =>
  ({ id, kind, points: points.map(([x, y]) => imagePoint(x, y)), closed: false, speed, capacity });

// Машины — только по арочному мосту справа (на картинке это единственная проезжая часть);
// встречная полоса смещена вниз.
const roads: CityRoute[] = [
  imageRoute('islands-bridge-east', 'road', [[1528,509],[1570,505],[1612,501],[1650,498],[1671,497]], 20, 2),
  imageRoute('islands-bridge-west', 'road', [[1671,505],[1650,506],[1612,509],[1570,513],[1528,517]], 20, 2),
];

// Жители гуляют по набережным и площадям, не через чаши фонтанов, крыши и фасады.
const walkers: CityRoute[] = [
  imageRoute('islands-walk-front', 'pedestrian', [[170,705],[200,740],[250,763],[320,775],[400,780],[480,785],[560,790],[640,795],[720,800],[800,806],[880,812]], 4.1, 7),
  imageRoute('islands-walk-left', 'pedestrian', [[20,465],[80,474],[140,487],[200,505]], 4.1, 7),
  imageRoute('islands-walk-plaza', 'pedestrian', [[600,270],[640,258],[690,250],[740,246],[800,244],[860,245],[920,251],[970,260],[1010,272]], 4.1, 7),
  imageRoute('islands-walk-sport', 'pedestrian', [[470,316],[520,320],[570,328],[620,341],[670,358]], 4.1, 7),
  imageRoute('islands-walk-family', 'pedestrian', [[1165,606],[1200,612],[1240,618],[1290,619]], 4.1, 7),
  imageRoute('islands-walk-east', 'pedestrian', [[1100,843],[1170,822],[1250,816],[1356,817],[1420,805]], 4.1, 7),
];

// Суда — на открытой воде: залив перед городом справа и бухта под нижними водопадами.
// ID совпадают с существующим boatsByRoute: используются прежние атласы судов.
const water: CityRoute[] = [
  imageRoute('wide-horizon-sail', 'water', [[1300,172],[1380,169],[1460,168],[1540,171],[1620,175],[1665,178]], 12, 1),
  imageRoute('wide-horizon-yacht', 'water', [[1385,203],[1440,212],[1500,222],[1560,229],[1620,236],[1665,242]], 12, 1),
  imageRoute('wide-bay-east-yacht', 'water', [[255,920],[320,922],[390,924],[460,925],[530,927],[600,930],[650,934]], 14, 1),
];

// Чаши фонтанов на новой карте: большой фонтан под глобусом и фонтан перед «Задачами».
const fountains: Fountain[] = [
  { id: 'central-globe', center: imagePoint(792, 415), rx: s(175), ry: s(40), height: s(45) },
  { id: 'globe-left', center: imagePoint(680, 400), rx: s(26), ry: s(9), height: s(26) },
  { id: 'globe-right', center: imagePoint(910, 400), rx: s(26), ry: s(9), height: s(26) },
  { id: 'tasks', center: imagePoint(792, 742), rx: s(95), ry: s(22), height: s(30) },
];

// Водопады: у маяка, на западной скале и три вдоль передних скал.
const waterfalls = [
  { id: 'lighthouse', start: imagePoint(122, 145), end: imagePoint(124, 225), width: s(35) },
  { id: 'cliff-west', start: imagePoint(118, 510), end: imagePoint(112, 636), width: s(80) },
  { id: 'cliff-small', start: imagePoint(235, 788), end: imagePoint(228, 842), width: s(58) },
  { id: 'cliff-middle', start: imagePoint(393, 812), end: imagePoint(385, 895), width: s(92) },
  { id: 'cliff-front', start: imagePoint(722, 834), end: imagePoint(718, 938), width: s(118) },
];

// Открытая вода: блики и суда рисуются только внутри этих областей.
const waterRegions: number[][][] = [
  area([[1290,148],[1672,140],[1672,290],[1600,262],[1520,247],[1420,236],[1350,218],[1300,190]]),
  area([[0,600],[60,610],[110,632],[150,655],[175,700],[190,760],[230,800],[300,840],[400,890],[560,905],[660,918],[660,941],[240,941],[240,860],[160,780],[0,760]]),
  area([[1530,530],[1672,505],[1672,941],[1520,941],[1560,880],[1620,850],[1640,760],[1625,680],[1600,640],[1540,640]]),
];

// Фонари вдоль набережных — зажигаются вечером и ночью.
const lights = [
  [153,480],[283,577],[713,487],[220,683],[189,727],[313,758],[500,770],[613,720],[657,777],
  [883,803],[1106,843],[1169,817],[1356,817],[1466,797],[1435,880],
].map(([x, y]) => xy(x, y));

// Иконки на крышах: периодический блик.
export const islandIcons: Record<string, [number, number]> = {
  health: [840, 85], sport: [465, 138], growth: [1205, 135], finance: [198, 272], career: [1103, 295],
  english: [1478, 280], driving: [455, 398], tasks: [790, 500], family: [1295, 450], together: [392, 598],
  psychology: [1118, 612], hobby: [1476, 612],
};
const signs = Object.values(islandIcons).map(([x, y]) => xy(x, y));

/** Прямоугольник в пикселях картинки → проценты. */
const box = (id: string, x: number, y: number, width: number, height: number) => ({
  id,
  x: +(x / ISLAND_IMAGE_WIDTH * 100).toFixed(2),
  y: +(y / ISLAND_IMAGE_HEIGHT * 100).toFixed(2),
  width: +(width / ISLAND_IMAGE_WIDTH * 100).toFixed(2),
  height: +(height / ISLAND_IMAGE_HEIGHT * 100).toFixed(2),
});

/** Кликабельные здания — от дальних к ближним: при перекрытии выигрывает здание, стоящее ближе. */
export const islandBuildings = [
  box('health', 620, 40, 435, 215),
  box('sport', 315, 100, 285, 200),
  box('growth', 1070, 95, 295, 210),
  box('finance', 45, 240, 305, 225),
  box('english', 1340, 240, 290, 230),
  box('career', 965, 255, 295, 215),
  box('driving', 310, 360, 290, 215),
  box('family', 1160, 405, 295, 195),
  box('tasks', 635, 460, 330, 250),
  box('together', 235, 560, 330, 215),
  box('hobby', 1330, 575, 290, 225),
  box('psychology', 975, 575, 300, 220),
] as const;

/** Подписи уровней: правый верхний угол таблички с названием сферы (проценты карты). */
const corner = (x: number, y: number): [number, number] => [+(x / ISLAND_IMAGE_WIDTH * 100).toFixed(2), +(y / ISLAND_IMAGE_HEIGHT * 100).toFixed(2)];
export const islandLevelBadges: Record<string, [number, number]> = {
  health: corner(942, 119), sport: corner(561, 168), growth: corner(1316, 168), finance: corner(304, 313),
  career: corner(1232, 343), english: corner(1578, 313), driving: corner(532, 442), tasks: corner(902, 546),
  family: corner(1428, 489), together: corner(530, 632), psychology: corner(1242, 659), hobby: corner(1594, 651),
};

/** Форма клика по зданию: круглые павильоны, углы прямоугольника — дорожки. */
export const islandHitShape = 'polygon(22% 0, 78% 0, 100% 24%, 100% 76%, 78% 100%, 22% 100%, 0 76%, 0 24%)';

export const islandProfile: CityProfile = {
  id: 'islands',
  width: ISLAND_WIDTH,
  height: ISLAND_HEIGHT,
  // Новая карта — новое хранилище маршрутов: старые точки не подходят к новой картинке.
  storageKey: 'play-your-life-live-city-routes-islands-v3',
  routes: [...roads, ...water, ...walkers],
  intersections: [],
  fountains,
  waterfalls,
  waterRegions,
  bridgeMasks: [],
  palms: [],
  // Прибой у подножия западных скал.
  beach: area([[0,605],[50,612],[100,628],[140,648]]),
  rainShine: area([[600,270],[800,244],[1000,270],[400,780],[720,800],[880,812]]),
  signs,
  lightPoints: lights,
  // Глобус нарисован на картинке; эллипс скрывает жителей, заходящих за шар.
  globe: null,
  occluders: [[s(800), s(335), s(88), s(90)]],
  cleanSurfaces: false,
  vehicleScale: 1.55,
  birdScale: 2.35,
  budgets: {
    low: { road: 2, water: 2, pedestrian: 22 },
    medium: { road: 3, water: 3, pedestrian: 34 },
    high: { road: 4, water: 3, pedestrian: 48 },
  },
};
