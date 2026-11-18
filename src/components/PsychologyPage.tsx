import { useState } from 'react';
import { PSYCHOLOGY_URL } from '../privateAccess';
import './PsychologyPage.css';

/** Раздел «Психология» (LIFE CITY) внутри игры: без рамки и отдельных кнопок, на всю высоту рабочей области. */
export default function PsychologyPage() {
  const [loaded, setLoaded] = useState(false);
  return (
    <section className="psy-embed" aria-label="Психология">
      {!loaded && <p className="psy-loading" role="status">Загружаем раздел «Психология»…</p>}
      <iframe
        title="Психология — LIFE CITY"
        src={PSYCHOLOGY_URL}
        className={loaded ? 'ready' : ''}
        onLoad={() => setLoaded(true)}
        allow="clipboard-write; fullscreen"
        referrerPolicy="no-referrer"
      />
    </section>
  );
}
