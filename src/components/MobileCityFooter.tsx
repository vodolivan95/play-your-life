import cityMap from '../assets/mobile-footer-wide.webp';
import PlayWordmark from './PlayWordmark';
import './MobileCityFooter.css';

/** Подвал главной на телефоне: горизонтальная карта острова с живыми машинами, яхтой и птицами, эмблема и надпись. */
export default function MobileCityFooter() {
  return (
    <div className="mobile-city-footer">
      <div className="mobile-footer-map" aria-hidden="true">
        <img className="mobile-footer-city-art" src={cityMap} width={1200} height={675} alt="" loading="lazy" decoding="async" draggable={false} />
        <i className="mfm-car mfm-car1" /><i className="mfm-car mfm-car2" /><i className="mfm-car mfm-car3" /><i className="mfm-boat" />
        <svg className="mfm-bird mfm-bird1" viewBox="0 0 12 6" width="11" height="6"><path d="M0 1 Q3 -1 6 3 Q9 -1 12 1" fill="none" stroke="#173a5c" strokeWidth="1.2" strokeLinecap="round" /></svg>
        <svg className="mfm-bird mfm-bird2" viewBox="0 0 12 6" width="9" height="5"><path d="M0 1 Q3 -1 6 3 Q9 -1 12 1" fill="none" stroke="#173a5c" strokeWidth="1.3" strokeLinecap="round" /></svg>
      </div>
      <PlayWordmark />
    </div>
  );
}
