export type Point = { x: number; y: number };
export type RouteKind = 'road' | 'water' | 'pedestrian';
export type CityRoute = {
  id: string; kind: RouteKind; points: Point[]; closed: boolean;
  speed: number; capacity: number; training?: boolean; runner?: boolean;
};
export const MAP_WIDTH = 1005;
export const MAP_HEIGHT = 1280;
export const normalized = (x: number, y: number): Point => ({ x: x / MAP_WIDTH, y: y / MAP_HEIGHT });
export const pixels = (point: Point): Point => ({ x: point.x * MAP_WIDTH, y: point.y * MAP_HEIGHT });
const route = (id: string, kind: RouteKind, coords: number[][], closed: boolean, speed: number, capacity: number, extra = {}): CityRoute =>
  ({ id, kind, points: coords.map(([x, y]) => normalized(x, y)), closed, speed, capacity, ...extra });

// Координаты только этой карты, в пикселях оригинала при авторинге и 0..1 при хранении.
// Полосы разнесены. Закругления не выходят за выпуклую оболочку контрольных точек.
export const roadGraph = {
  lanes: [
    route('globe-inner', 'road', [[361,535],[375,493],[409,462],[449,442],[475,432],[517,424],[559,437],[604,462],[638,493],[651,533],[639,570],[603,603],[558,623],[502,630],[448,617],[399,595],[367,565]], true, 23, 3),
    route('globe-outer', 'road', [[367,483],[403,452],[443,432],[474,420],[518,413],[563,426],[613,452],[651,488],[664,535],[651,578],[615,614],[563,635],[503,642],[446,629],[394,605],[357,572],[350,533]], true, 20, 2),
    route('tasks-inner', 'road', [[526,775],[570,795],[634,821],[678,849],[701,883],[699,912],[682,945],[652,973],[615,993],[583,999],[548,990],[491,975],[430,958],[361,942],[302,927],[254,914],[241,903],[266,879],[300,858],[340,839],[380,825],[421,809],[463,792],[492,779]], true, 22, 3),
    route('tasks-outer', 'road', [[576,784],[641,810],[688,841],[714,882],[712,921],[694,955],[662,984],[622,1007],[583,1013],[546,1004],[488,989],[425,972],[358,955],[298,940],[251,928],[233,918],[229,901],[257,869],[293,847],[334,827],[374,813],[414,797],[453,781],[484,767],[526,764]], true, 20, 2),
    route('north-to-south', 'road', [[705,181],[683,204],[658,246],[632,285],[607,327],[582,366],[557,397],[517,424],[559,437],[604,462],[638,493],[651,533],[639,570],[603,603],[558,623],[520,634],[492,650],[495,686],[500,729],[522,763],[568,791],[629,817],[680,849],[701,883],[715,920],[726,949],[718,990],[705,1026],[741,1050],[803,1087],[877,1122],[941,1144],[1005,1158]], false, 25, 2),
    route('south-to-north', 'road', [[1005,1143],[951,1130],[887,1108],[813,1073],[754,1036],[728,1016],[736,994],[750,940],[735,896],[723,880],[692,839],[638,804],[577,778],[535,751],[515,721],[509,683],[506,648],[503,642],[446,629],[394,605],[357,572],[350,533],[367,483],[403,452],[443,432],[474,420],[518,413],[568,407],[594,374],[620,334],[645,293],[671,253],[696,211],[715,189]], false, 23, 2),
    route('driving-training', 'road', [[261,661],[279,650],[308,650],[332,660],[343,674],[326,683],[294,684],[269,678]], true, 9, 1, { training: true }),
  ],
  intersections: [
    { id: 'north-plaza', center: normalized(519,422), radius: 24 },
    { id: 'globe-south', center: normalized(500,642), radius: 23 },
    { id: 'tasks-north', center: normalized(526,776), radius: 26 },
    { id: 'tasks-east', center: normalized(710,884), radius: 23 },
  ],
  roundabouts: [
    { id: 'globe', center: normalized(502,530), radius: 160, lanes: ['globe-inner','globe-outer'] },
    { id: 'tasks', center: normalized(531,889), radius: 170, lanes: ['tasks-inner','tasks-outer'] },
  ],
};
export const waterPaths: CityRoute[] = [
  route('ocean-yachts', 'water', [[0,1133],[61,1160],[161,1194],[242,1221],[308,1260],[327,1280]], false, 9, 2),
  route('ocean-speedboats', 'water', [[361,1280],[390,1232],[429,1185],[457,1145],[485,1114],[468,1092],[416,1080],[346,1090],[273,1115],[203,1114],[161,1090],[134,1052],[116,1013],[106,981],[99,958],[81,939],[47,939],[0,955]], false, 15, 2),
  route('west-cruise', 'water', [[0,388],[35,430],[30,469],[29,507],[35,544],[31,590],[25,641],[34,688],[37,731],[21,770],[0,792]], false, 8, 1),
  route('west-sail', 'water', [[0,1230],[28,1205],[69,1162],[105,1116],[97,1076],[66,1044],[30,1020],[0,1007]], false, 6, 1),
];
export const pedestrianPaths: CityRoute[] = [
  route('health-promenade', 'pedestrian', [[402,268],[433,280],[454,287],[460,302],[440,316],[413,313],[397,298]], true, 4, 2),
  route('health-fountain', 'pedestrian', [[563,279],[578,302],[567,322],[552,337],[533,345],[547,365],[574,365]], false, 3.8, 2),
  route('growth-plaza', 'pedestrian', [[688,359],[706,347],[735,347],[776,348],[801,355],[844,371],[876,379]], false, 4, 2),
  route('finance-plaza', 'pedestrian', [[132,537],[166,553],[207,564],[247,568],[282,558]], false, 3.6, 2),
  route('english-plaza', 'pedestrian', [[723,551],[755,565],[780,566],[815,569],[855,582],[907,585]], false, 3.8, 2),
  route('joint-plaza', 'pedestrian', [[619,786],[651,789],[692,797],[744,811],[790,814],[841,810],[885,794]], false, 4, 2),
  route('tasks-plaza', 'pedestrian', [[417,928],[445,944],[480,950],[516,957],[553,957],[591,950],[624,934]], false, 4, 2),
  route('leisure-plaza', 'pedestrian', [[783,1033],[819,1046],[854,1053],[892,1062],[931,1073],[971,1082]], false, 3.5, 2),
  route('sport-runners', 'pedestrian', [[111,268],[137,276],[170,295],[177,308],[157,307],[126,294],[98,275],[96,263]], true, 10, 2, { runner: true }),
];
export const defaultRoutes = [...roadGraph.lanes, ...waterPaths, ...pedestrianPaths];

export type Fountain = { id: string; center: Point; rx: number; ry: number; height: number };
export const fountains: Fountain[] = [
  { id:'health-heart', center:normalized(507,308), rx:51, ry:16, height:19 },
  { id:'health-front', center:normalized(505,368), rx:29, ry:9, height:28 },
  { id:'growth', center:normalized(746,382), rx:46, ry:15, height:31 },
  { id:'finance', center:normalized(248,565), rx:33, ry:10, height:19 },
  { id:'central-globe', center:normalized(503,539), rx:95, ry:29, height:39 },
  { id:'english', center:normalized(791,581), rx:47, ry:14, height:24 },
  { id:'joint-tasks', center:normalized(804,795), rx:42, ry:13, height:24 },
  { id:'leisure', center:normalized(931,1066), rx:42, ry:13, height:23 },
];
export const waterfalls = [
  { id:'lighthouse', start:normalized(146,128), end:normalized(128,212), width:33 },
  { id:'sport', start:normalized(109,321), end:normalized(99,368), width:19 },
  { id:'upper-west', start:normalized(343,389), end:normalized(326,438), width:29 },
  { id:'finance-west', start:normalized(64,574), end:normalized(44,614), width:21 },
  { id:'driving-west', start:normalized(146,823), end:normalized(131,883), width:32 },
  { id:'lower-west', start:normalized(25,945), end:normalized(18,982), width:20 },
  { id:'tasks-west', start:normalized(396,1003), end:normalized(383,1061), width:30 },
  { id:'tasks-south', start:normalized(553,1049), end:normalized(541,1100), width:19 },
];
export const waterRegions: number[][][] = [
  [[0,222],[40,243],[61,349],[10,381],[0,391]],
  [[0,357],[45,369],[61,473],[41,542],[20,665],[59,746],[16,817],[0,815]],
  [[0,985],[39,1008],[96,1041],[176,1067],[293,1082],[416,1069],[486,1088],[535,1138],[574,1242],[616,1280],[0,1280]],
  [[29,919],[93,906],[127,938],[160,966],[175,992],[151,1036],[107,1014],[61,967]],
  [[664,1178],[703,1195],[842,1210],[1005,1243],[1005,1280],[776,1280]],
];
// Перерисовка точных фрагментов оригинала над судами: мост и его опоры скрывают судно.
export const bridgeMasks: number[][][] = [
  [[0,640],[52,618],[174,585],[190,618],[42,660],[0,681]],
  [[45,914],[86,910],[183,946],[183,982],[90,948],[47,943]],
  [[347,983],[570,1043],[565,1110],[529,1096],[528,1075],[503,1061],[487,1058],[476,1090],[449,1080],[450,1050],[415,1040],[400,1069],[370,1057]],
];
export const palms = [[401,449],[335,595],[660,590],[712,789],[961,832],[686,982],[431,794],[185,555]];
export const lightPoints = [
  [421,201],[452,189],[566,199],[603,211],[487,246],[536,249],
  [207,234],[228,252],[287,270],[735,280],[779,308],[918,292],
  [174,459],[206,494],[277,515],[752,502],[784,538],[901,529],
  [191,726],[251,749],[362,752],[648,741],[713,766],[866,747],
  [457,895],[505,915],[581,910],[795,972],[844,1002],[949,1011],
  [288,343],[357,365],[670,429],[630,465],[346,558],[428,612],[568,636],[514,706],[377,883],[658,950],[524,1002],
];

export function validRoutes(value: unknown): value is CityRoute[] {
  if (!Array.isArray(value) || !value.length || value.length > 60) return false;
  const ids = new Set<string>();
  return value.every((r: CityRoute) => {
    if (!r || typeof r.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(r.id) || ids.has(r.id)) return false;
    ids.add(r.id);
    return ['road','water','pedestrian'].includes(r.kind) && typeof r.closed === 'boolean' &&
      Number.isFinite(r.speed) && r.speed > 0 && r.speed <= 35 && Number.isInteger(r.capacity) && r.capacity >= 1 && r.capacity <= 12 &&
      Array.isArray(r.points) && r.points.length >= 3 && r.points.length <= 100 &&
      r.points.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) &&
      r.points.some(p => Math.hypot(p.x-r.points[0].x,p.y-r.points[0].y) > .015);
  });
}
