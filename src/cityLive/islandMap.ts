// Островная карта «Города»: все точки сняты с исходника 6712 × 3748 px.
// Маршруты хранятся нормализованными, но авторингуются в координатах исходного изображения,
// чтобы замена самого изображения не смешивалась с геометрией старой широкой карты.
import type { CityProfile, CityRoute, Fountain, Point } from './paths.ts';

export const ISLAND_SOURCE_WIDTH = 6712;
export const ISLAND_SOURCE_HEIGHT = 3748;
export const ISLAND_WIDTH = 2000;
/** Точные пропорции карты со зданием психологии и отдельной парковой террасой. */
export const ISLAND_IMAGE_WIDTH = 1678;
export const ISLAND_IMAGE_HEIGHT = 937;
export const ISLAND_HEIGHT = ISLAND_WIDTH * ISLAND_IMAGE_HEIGHT / ISLAND_IMAGE_WIDTH;

const scale = ISLAND_WIDTH / ISLAND_SOURCE_WIDTH;
const p = (x: number, y: number): Point => ({ x: x / ISLAND_SOURCE_WIDTH, y: y / ISLAND_SOURCE_HEIGHT });
const xy = (x: number, y: number): [number, number] => [x * scale, y * scale];
const px = (value: number) => value * scale;
const area = (points: number[][]): number[][] => points.map(([x, y]) => xy(x, y));

// Точки дорожек уточнены по финальной иллюстрации, не по старым площадям.
const imagePoint = (x: number, y: number): Point => ({ x: x / ISLAND_IMAGE_WIDTH, y: y / ISLAND_IMAGE_HEIGHT });
const imageRoute = (id: string, kind: CityRoute['kind'], points: number[][], speed: number, capacity: number): CityRoute =>
  ({ id, kind, points: points.map(([x, y]) => imagePoint(x, y)), closed: false, speed, capacity });

// Только видимые прибрежные полосы и мост перед саморазвитием; встречная полоса смещена.
const roads: CityRoute[] = [
  imageRoute('islands-coast-west-east', 'road', [[370,598],[450,626],[530,660],[600,702],[663,725],[720,745]], 23, 4),
  imageRoute('islands-coast-west-west', 'road', [[720,740],[663,720],[600,697],[530,655],[450,621],[370,593]], 23, 4),
  imageRoute('islands-hobby-coast-east', 'road', [[1330,699],[1416,735],[1473,751],[1512,764]], 23, 4),
  imageRoute('islands-hobby-coast-west', 'road', [[1512,759],[1473,746],[1416,730],[1330,694]], 23, 4),
  imageRoute('islands-growth-bridge-east', 'road', [[970,427],[1070,407],[1200,387],[1280,364]], 23, 4),
  imageRoute('islands-growth-bridge-west', 'road', [[1280,359],[1200,382],[1070,402],[970,422]], 23, 4),
];

// Жители идут по передним прогулочным дугам и дорожкам, не через чаши фонтанов,
// фасады, клумбы и крыши. Короткие незамкнутые прогулки плавно сменяют жителей.
const walkers: CityRoute[] = [
  imageRoute('islands-walk-sport', 'pedestrian', [[450,362],[465,369],[485,374],[508,376],[530,375],[555,370]], 4.1, 7),
  imageRoute('islands-walk-health', 'pedestrian', [[733,306],[746,323],[770,330],[794,334],[816,335],[840,331],[864,323],[889,310]], 4.1, 7),
  imageRoute('islands-walk-finance', 'pedestrian', [[247,542],[265,551],[286,553],[309,550],[331,541],[349,531]], 4.1, 7),
  imageRoute('islands-walk-globe', 'pedestrian', [[811,481],[814,492],[817,504],[820,516]], 4.1, 7),
  imageRoute('islands-walk-growth', 'pedestrian', [[1075,382],[1097,393],[1120,397],[1144,397],[1168,393],[1189,388]], 4.1, 7),
  imageRoute('islands-walk-english', 'pedestrian', [[1427,480],[1444,489],[1468,496],[1494,499],[1520,498],[1545,490]], 4.1, 7),
  imageRoute('islands-walk-tasks', 'pedestrian', [[771,750],[790,758],[816,764],[844,768],[872,766],[900,760],[924,752]], 4.1, 7),
  imageRoute('islands-walk-together', 'pedestrian', [[1214,634],[1232,643],[1255,648],[1280,651],[1303,649],[1324,643],[1345,634]], 4.1, 7),
  imageRoute('islands-walk-hobby', 'pedestrian', [[1518,748],[1536,759],[1558,766],[1584,768],[1608,763],[1630,754]], 4.1, 7),
  imageRoute('islands-walk-park', 'pedestrian', [[812,860],[843,876],[880,889],[920,898],[960,900],[1000,896],[1040,886],[1063,877]], 4.1, 7),
  imageRoute('islands-walk-psychology', 'pedestrian', [[1154,819],[1176,834],[1205,843],[1237,846],[1263,849],[1298,844],[1330,835],[1356,824]], 4.1, 7),
  imageRoute('islands-walk-driving', 'pedestrian', [[502,599],[524,609],[548,614],[571,613],[592,607],[611,601]], 4.1, 7),
];

// Суда оставлены на открытой воде: дальний горизонт, левое море и удалённая южная вода.
// ID намеренно совпадают с существующим boatsByRoute: используются только старые атласы судов.
const water: CityRoute[] = [
  imageRoute('wide-horizon-sail', 'water', [[365,125],[415,122],[465,121],[515,121],[570,124]], 12, 1),
  // Залив перед дальним городом и над английским островом, а не силуэт небоскрёбов.
  imageRoute('wide-horizon-yacht', 'water', [[1425,268],[1470,269],[1510,273],[1550,277]], 12, 1),
  // Коридор между материковыми камнями и островными обрывами. Узкий канал не имеет встречной полосы.
  imageRoute('wide-bay-east-yacht', 'water', [[355,778],[400,804],[450,830],[500,854],[548,882]], 14, 1),
];

// Чаши фонтанов привязаны к финальной карте, включая сохранённый фонтан парка.
const imageSize = (value: number) => value * ISLAND_WIDTH / ISLAND_IMAGE_WIDTH;
const fountains: Fountain[] = [
  { id: 'sport', center: imagePoint(500, 355), rx: imageSize(45), ry: imageSize(13), height: imageSize(28) },
  { id: 'health', center: imagePoint(810, 300), rx: imageSize(70), ry: imageSize(22), height: imageSize(35) },
  { id: 'growth', center: imagePoint(1128, 370), rx: imageSize(53), ry: imageSize(17), height: imageSize(28) },
  { id: 'finance', center: imagePoint(290, 522), rx: imageSize(55), ry: imageSize(18), height: imageSize(32) },
  { id: 'central-globe', center: imagePoint(805, 448), rx: imageSize(99), ry: imageSize(33), height: imageSize(42) },
  { id: 'tasks', center: imagePoint(846, 740), rx: imageSize(59), ry: imageSize(19), height: imageSize(28) },
  { id: 'together', center: imagePoint(1270, 620), rx: imageSize(55), ry: imageSize(18), height: imageSize(30) },
  { id: 'english', center: imagePoint(1480, 470), rx: imageSize(52), ry: imageSize(15), height: imageSize(26) },
  { id: 'hobby', center: imagePoint(1570, 735), rx: imageSize(62), ry: imageSize(20), height: imageSize(28) },
  { id: 'psychology', center: imagePoint(1260, 821), rx: imageSize(53), ry: imageSize(17), height: imageSize(28) },
  { id: 'park-front', center: imagePoint(936, 841), rx: imageSize(59), ry: imageSize(19), height: imageSize(28) },
];

const waterfalls = [
  { id: 'lighthouse', start: p(500, 720), end: p(510, 1280), width: px(115) },
  { id: 'sport-west', start: p(1080, 1140), end: p(1040, 1530), width: px(82) },
  { id: 'sport-south', start: p(1930, 1530), end: p(1910, 1780), width: px(72) },
  { id: 'health-west', start: p(2760, 1100), end: p(2720, 1390), width: px(72) },
  { id: 'health-east', start: p(4100, 1100), end: p(4090, 1365), width: px(68) },
  { id: 'growth-east', start: p(5310, 1370), end: p(5300, 1635), width: px(72) },
  { id: 'english-east', start: p(6600, 1700), end: p(6585, 2030), width: px(74) },
  { id: 'finance-west', start: p(360, 1850), end: p(335, 2320), width: px(100) },
  { id: 'finance-south', start: p(1250, 2180), end: p(1230, 2510), width: px(78) },
  { id: 'driving-south', start: p(2020, 2420), end: p(1990, 2770), width: px(94) },
  { id: 'tasks-south', start: p(3020, 3000), end: p(3000, 3370), width: px(88) },
  { id: 'park-front', start: imagePoint(940, 916), end: imagePoint(940, 936), width: imageSize(24) },
  { id: 'psychology-front', start: imagePoint(1268, 866), end: imagePoint(1264, 914), width: imageSize(24) },
  { id: 'hobby-south', start: p(6480, 2800), end: p(6460, 3150), width: px(82) },
];

// Только открытая вода, не каналы под мостами: это исключает блики и суда на скалах/перекрытиях.
const waterRegions: number[][][] = [
  [[345,108],[580,108],[620,125],[620,153],[390,158],[340,147]].map(([x,y])=>[imageSize(x),imageSize(y)]),
  [[335,735],[375,749],[425,776],[475,800],[525,825],[575,851],[610,889],[590,925],[520,899],[465,873],[410,846],[360,818],[335,799]].map(([x,y])=>[imageSize(x),imageSize(y)]),
  area([[5580,1070],[5920,1030],[6300,1050],[6712,1130],[6712,1440],[6510,1480],[6180,1380],[5860,1270]]),
];

const lights = [
  [1690,1320],[1900,1290],[2110,1350],[3120,1060],[3340,1035],[3530,1095],
  [4560,1400],[4750,1380],[4940,1440],[930,1980],[1110,1950],[1300,2000],
  [2900,1510],[3220,1430],[3510,1515],[3160,2830],[3370,2800],[3560,2850],
  [4620,2160],[4840,2130],[5040,2190],[5750,1750],[5910,1725],[6090,1780],
  [6100,2610],[6260,2580],[6450,2640],[4570,3060],[4710,3035],[4900,3090],
].map(([x, y]) => xy(x, y));

const signs = [
  [3350,760],[1920,1120],[4740,1160],[1090,1740],[5900,1510],
  [2180,2050],[4840,1970],[3370,2570],[6250,2370],
].map(([x, y]) => xy(x, y)).concat([[imageSize(1247), imageSize(740)]]);

/** Кликабельные фасады в процентах новой картинки; дороги и сохранённый парк намеренно исключены. */
const box = (id: string, x: number, y: number, width: number, height: number) => ({
  id,
  x: +(x / ISLAND_SOURCE_WIDTH * 100).toFixed(2),
  y: +(y / ISLAND_SOURCE_HEIGHT * 100).toFixed(2),
  width: +(width / ISLAND_SOURCE_WIDTH * 100).toFixed(2),
  height: +(height / ISLAND_SOURCE_HEIGHT * 100).toFixed(2),
});

export const islandBuildings = [
  box('health', 2780, 280, 1400, 900),
  box('sport', 1190, 690, 1510, 900),
  box('growth', 4160, 720, 1410, 900),
  box('finance', 340, 1160, 1420, 1160),
  box('english', 5350, 950, 1320, 980),
  box('driving', 1600, 1720, 1370, 870),
  box('together', 4210, 1630, 1450, 1030),
  box('tasks', 2730, 2180, 1480, 900),
  box('hobby', 5340, 1970, 1370, 1050),
  { id: 'psychology', x: 66.8, y: 67.8, width: 16.5, height: 18.2 },
] as const;

export const islandProfile: CityProfile = {
  id: 'islands',
  width: ISLAND_WIDTH,
  height: ISLAND_HEIGHT,
  // Старые локальные маршруты остаются в v1, но не накладываются на новое здание и парк.
  storageKey: 'play-your-life-live-city-routes-islands-v2',
  routes: [...roads, ...water, ...walkers],
  intersections: [],
  fountains,
  waterfalls,
  waterRegions,
  bridgeMasks: [],
  palms: [[1370,1150],[2640,1310],[4070,1320],[5430,1570],[1510,2250],[4150,2730],[5530,2720]].map(([x, y]) => xy(x, y)),
  beach: area([[0,2650],[200,2720],[440,2810],[730,2920],[1020,3030],[1350,3130]]),
  rainShine: [[820,1940],[1200,2050],[1700,2180],[2650,2350],[4050,2460],[5300,2300]].map(([x, y]) => xy(x, y)),
  signs,
  lightPoints: lights,
  // Глобус является частью фонового изображения; овал не даёт машинам и NPC появляться поверх него.
  globe: null,
  occluders: [[px(3222), px(1575), px(230), px(220)]],
  cleanSurfaces: false,
  vehicleScale: 1.55,
  birdScale: 2.35,
  // Умеренное население: 30/50/75 NPC на low/medium/high; телефонный AUTO использует medium.
  budgets: {
    low: { road: 9, water: 3, pedestrian: 30 },
    medium: { road: 14, water: 3, pedestrian: 50 },
    high: { road: 20, water: 3, pedestrian: 75 },
  },
};
