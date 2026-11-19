import cityBackground from './assets/coastal-city-enhanced.webp';
import citySkyline from './assets/city-skyline.webp';
import cleanSurfaces from './assets/city-clean-surfaces.webp';
import existingIcons from './assets/sphere-icons.png';
import health from './assets/sphere-buildings/health-building.jpg';
import sport from './assets/sphere-buildings/sport-building.jpg';
import growth from './assets/sphere-buildings/self-development-building.jpg';
import english from './assets/sphere-buildings/english-building.jpg';
import finance from './assets/sphere-buildings/finance-building.jpg';
import together from './assets/sphere-buildings/joint-tasks-building.jpg';
import driving from './assets/sphere-buildings/driving-building.jpg';
import tasks from './assets/sphere-buildings/tasks-building.jpg';
import hobby from './assets/sphere-buildings/leisure-building.webp';
import psychology from './assets/sphere-buildings/psychology-building.jpg';
import family from './assets/sphere-buildings/family-building.jpg';
import career from './assets/sphere-buildings/career-building.jpg';
// Широкие кадры 3:1 для шапки страницы сферы (0.89.14, прислал пользователь); остальные сферы используют карточное фото.
import healthScene from './assets/sphere-buildings/health-scene.jpg';
import sportScene from './assets/sphere-buildings/sport-scene.jpg';
import financeScene from './assets/sphere-buildings/finance-scene.jpg';
import hobbyScene from './assets/sphere-buildings/hobby-scene.jpg';
import englishScene from './assets/sphere-buildings/english-scene.jpg';
import growthScene from './assets/sphere-buildings/growth-scene.jpg';
import { coastalBuildings } from './coastalCity';

// Фотографии UI отделены от ресурсов игровой карты. Иконки и комнаты сохраняются.
export const cityAssets = { background: cityBackground, cleanSurfaces, preview: cityBackground, skyline: citySkyline, width: 1005, height: 1280 };
const thumbnails = { health, sport, growth, english, finance, together, driving, tasks, hobby };
const covers = {health,sport,growth,english,finance,together,driving,tasks,hobby};
const scenes: Record<string, string> = { health: healthScene, sport: sportScene, finance: financeScene, hobby: hobbyScene, english: englishScene, growth: growthScene, family, career };
/** Фото для широкой шапки страницы сферы: отдельный широкий кадр, если он есть, иначе карточное фото. */
export function sphereSceneImage(id: string): string | undefined {
  return scenes[id] ?? (sphereAssets as Record<string, SphereAsset | undefined>)[id]?.buildingThumbnail;
}
type SphereAsset = {
  icon: { source: string; id: string }; buildingThumbnail: string; building: string; questCover: string;
  cityBuilding: { background: string; bounds: typeof coastalBuildings[number] }; room: string;
};
export const sphereAssets = {
  ...Object.fromEntries(coastalBuildings.map(building => [building.id, {
    icon: { source: existingIcons, id: building.id },
    buildingThumbnail: thumbnails[building.id],
    building: covers[building.id],
    questCover: covers[building.id],
    cityBuilding: { background: cityBackground, bounds: building },
    room: building.id === 'sport' ? 'existing-sport-3d' : 'existing-room-preparation',
  }])),
  // «Психология» пока не нарисована на острове «Города» (coastalBuildings/wideBuildings) — у неё
  // ещё нет места на общей карте с машинами и жителями. Карточка сферы и обложки целей используют
  // отдельную фотографию `psychology-building.jpg` (прислана пользователем 22 октября 2026,
  // версия 0.53.2) — реальную художественную картинку, как и у остальных девяти сфер, но без места
  // на общей карте острова до отдельной задачи на отрисовку здания там.
  psychology: {
    icon: { source: existingIcons, id: 'psychology' },
    buildingThumbnail: psychology,
    building: psychology,
    questCover: psychology,
    // bounds — техническое поле, сейчас нигде не читается; у «Психологии» нет своей области на карте.
    cityBuilding: { background: cityBackground, bounds: coastalBuildings[0] },
    room: 'existing-room-preparation',
  },
  // «Семья и отношения» и «Карьера и бизнес» (0.88.0, фото прислал пользователь) — как «Психология»: без места на острове.
  ...Object.fromEntries((['family', 'career'] as const).map((id) => [id, {
    icon: { source: existingIcons, id },
    buildingThumbnail: id === 'family' ? family : career,
    building: id === 'family' ? family : career,
    questCover: id === 'family' ? family : career,
    cityBuilding: { background: cityBackground, bounds: coastalBuildings[0] },
    room: 'existing-room-preparation',
  }])),
} as Record<keyof typeof thumbnails | 'psychology' | 'family' | 'career', SphereAsset>;
