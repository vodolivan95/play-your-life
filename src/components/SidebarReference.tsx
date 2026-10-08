import city from '../assets/sidebar-coastal-city.webp';
import PlayWordmark from './PlayWordmark';

export default function SidebarReference({ part }: { part: 'logo' | 'city' }) {
  if (part === 'logo') return <div className="sidebar-reference sidebar-reference-logo"><PlayWordmark horizontal /></div>;
  return <div className="sidebar-reference sidebar-reference-city"><img className="sidebar-city-art" src={city} width={850} height={1851} alt="Прибрежный город PLAY YOUR LIFE" loading="lazy" decoding="async" /><PlayWordmark /></div>;
}
