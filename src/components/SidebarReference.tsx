import { cityAssets } from '../sphereAssets';
import BrandLogo from './BrandLogo';
const city = cityAssets.preview;

export default function SidebarReference({ part }: { part: 'logo' | 'city' }) {
  if (part === 'logo') return <div className="sidebar-reference sidebar-reference-logo"><BrandLogo size={76} /></div>;
  return <div className="sidebar-reference sidebar-reference-city"><img className="sidebar-city-art" src={city} alt="Прибрежный город PLAY YOUR LIFE с девятью зданиями" /><BrandLogo size={73} /></div>;
}
