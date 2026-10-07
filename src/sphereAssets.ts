import cityBackground from './assets/coastal-city.jpg';
import cityPreview from './assets/city-preview.webp';
import citySkyline from './assets/city-skyline.webp';
import existingIcons from './assets/sphere-icons.png';
import health from './assets/buildings/health.webp';
import sport from './assets/buildings/sport.webp';
import growth from './assets/buildings/self-development.webp';
import english from './assets/buildings/english.webp';
import finance from './assets/buildings/finance.webp';
import together from './assets/buildings/joint-tasks.webp';
import driving from './assets/buildings/driving.webp';
import tasks from './assets/buildings/tasks.webp';
import hobby from './assets/buildings/leisure.webp';
import { coastalBuildings } from './coastalCity';

// Фотографии из MASTER VISUAL SOURCE. UI-иконки и комнаты не переоформляются.
export const cityAssets = { background: cityBackground, preview: cityPreview, skyline: citySkyline, width: 1005, height: 1280 };
const thumbnails = { health, sport, growth, english, finance, together, driving, tasks, hobby };
export const sphereAssets = Object.fromEntries(coastalBuildings.map(building => [building.id, {
  icon: { source: existingIcons, id: building.id },
  buildingThumbnail: thumbnails[building.id],
  cityBuilding: { background: cityBackground, bounds: building },
  room: building.id === 'sport' ? 'existing-sport-3d' : 'existing-room-preparation',
}])) as Record<keyof typeof thumbnails, {
  icon: { source: string; id: string }; buildingThumbnail: string;
  cityBuilding: { background: string; bounds: typeof coastalBuildings[number] }; room: string;
}>;
