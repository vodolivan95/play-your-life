import CityMiniLive from './CityMiniLive';
import PlayWordmark from './PlayWordmark';
import './MobileCityFooter.css';

/** Подвал главной на телефоне: горизонтальная карта острова с живыми машинами, яхтой и птицами, эмблема и надпись. */
export default function MobileCityFooter() {
  return (
    <div className="mobile-city-footer">
      <div className="mobile-footer-map" aria-hidden="true"><CityMiniLive /></div>
      <PlayWordmark tagline="Ты — творец своей истории." />
    </div>
  );
}
