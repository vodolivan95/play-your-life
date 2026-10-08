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
import { coastalBuildings } from './coastalCity';

// Фотографии UI отделены от ресурсов игровой карты. Иконки и комнаты сохраняются.
export const cityAssets = { background: cityBackground, cleanSurfaces, preview: cityBackground, skyline: citySkyline, width: 1005, height: 1280 };
const thumbnails = { health, sport, growth, english, finance, together, driving, tasks, hobby };
const covers = {health,sport,growth,english,finance,together,driving,tasks,hobby};
export const sphereAssets = Object.fromEntries(coastalBuildings.map(building => [building.id, {
  icon: { source: existingIcons, id: building.id },
  buildingThumbnail: thumbnails[building.id],
  building: covers[building.id],
  questCover: covers[building.id],
  cityBuilding: { background: cityBackground, bounds: building },
  room: building.id === 'sport' ? 'existing-sport-3d' : 'existing-room-preparation',
}])) as Record<keyof typeof thumbnails, {
  icon: { source: string; id: string }; buildingThumbnail: string; building:string; questCover:string;
  cityBuilding: { background: string; bounds: typeof coastalBuildings[number] }; room: string;
}>;
