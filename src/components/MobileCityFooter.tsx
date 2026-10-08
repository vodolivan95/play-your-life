import city from '../assets/mobile-footer-city.webp';
import PlayWordmark from './PlayWordmark';

export default function MobileCityFooter() {
  return (
    <div className="mobile-city-footer">
      <img className="mobile-footer-city-art" src={city} width={1374} height={1145} alt="Прибрежный город PLAY YOUR LIFE" loading="lazy" decoding="async" />
      <PlayWordmark />
    </div>
  );
}
