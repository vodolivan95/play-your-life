import CityMiniLive from './CityMiniLive';
import PlayWordmark from './PlayWordmark';
import './MobileCityFooter.css';

/** Подвал главной на телефоне: актуальная карта острова с психологией, эмблема и надпись. */
export default function MobileCityFooter() {
  return (
    <div className="mobile-city-footer">
      <div className="mobile-footer-map" aria-hidden="true"><CityMiniLive updated /></div>
      <PlayWordmark tagline="Ты — творец своей истории." />
    </div>
  );
}
