import icons from '../assets/sphere-icons.png';
import './SphereIcon.css';

// Display the supplied nine-icon sheet without labels or altering its pixels.
const crops: Record<string, [number, number]> = {
  health: [38, 2], sport: [410, 2], growth: [790, 2],
  english: [38, 315], finance: [410, 315], together: [790, 315],
  driving: [38, 636], tasks: [410, 636], hobby: [790, 636],
};
export default function SphereIcon({ id }: { id: string }) {
  const crop = crops[id];
  if (!crop) return null;
  return (
    <svg className={`game-art game-art-${id} sphere-ui-icon`} viewBox={`${crop[0]} ${crop[1]} 295 264`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" data-sphere-icon={id}>
      <image href={icons} width="1149" height="984" />
    </svg>
  );
}
