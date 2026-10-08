import cityBackground from './assets/coastal-city-enhanced.webp';
import citySkyline from './assets/city-skyline.webp';
import cleanSurfaces from './assets/city-clean-surfaces.webp';
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
import healthCover from './assets/quest-covers/health.webp';
import sportCover from './assets/quest-covers/sport.webp';
import growthCover from './assets/quest-covers/self-development.webp';
import englishCover from './assets/quest-covers/english.webp';
import financeCover from './assets/quest-covers/finance.webp';
import togetherCover from './assets/quest-covers/joint-tasks.webp';
import drivingCover from './assets/quest-covers/driving.webp';
import tasksCover from './assets/quest-covers/tasks.webp';
import hobbyCover from './assets/quest-covers/leisure.webp';
import { coastalBuildings } from './coastalCity';

// Фотографии из MASTER VISUAL SOURCE. UI-иконки и комнаты не переоформляются.
export const cityAssets = { background: cityBackground, cleanSurfaces, preview: cityBackground, skyline: citySkyline, width: 1005, height: 1280 };
const thumbnails = { health, sport, growth, english, finance, together, driving, tasks, hobby };
const covers = {health:healthCover,sport:sportCover,growth:growthCover,english:englishCover,finance:financeCover,together:togetherCover,driving:drivingCover,tasks:tasksCover,hobby:hobbyCover};
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
