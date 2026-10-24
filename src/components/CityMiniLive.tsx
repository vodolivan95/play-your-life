import cityMap from '../assets/mobile-footer-wide.webp';
import updatedCityMap from '../assets/mobile-footer-islands.webp';
import './CityMiniLive.css';

/** Миниатюра города для меню; мобильный футер может показывать актуальный остров с психологией. */
export default function CityMiniLive({ updated = false }: { updated?: boolean } = {}) {
  const map = updated ? updatedCityMap : cityMap;
  return (
    <div className={`mfm-stage${updated ? ' mfm-stage-updated' : ''}`} aria-hidden="true">
      <img className="mfm-pan" src={map} width={1200} height={updated ? 670 : 675} alt="" loading="lazy" decoding="async" draggable={false} />
      {!updated && <>
        <i className="mfm-car mfm-car1" /><i className="mfm-car mfm-car2" /><i className="mfm-car mfm-car3" /><i className="mfm-boat" />
        <svg className="mfm-bird mfm-bird1" viewBox="0 0 12 6" width="11" height="6"><path d="M0 1 Q3 -1 6 3 Q9 -1 12 1" fill="none" stroke="#173a5c" strokeWidth="1.2" strokeLinecap="round" /></svg>
        <svg className="mfm-bird mfm-bird2" viewBox="0 0 12 6" width="9" height="5"><path d="M0 1 Q3 -1 6 3 Q9 -1 12 1" fill="none" stroke="#173a5c" strokeWidth="1.3" strokeLinecap="round" /></svg>
      </>}
    </div>
  );
}
