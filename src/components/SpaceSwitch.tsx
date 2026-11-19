import type { LifeMode } from '../ourLife';

/** Переключатель «Моя жизнь | Наша жизнь» (ТЗ 3.1): две равные половины, активная выделена. */
export default function SpaceSwitch({ mode, onChange }: { mode: LifeMode; onChange: (mode: LifeMode) => void }) {
  return (
    <div className="pyl-space" role="group" aria-label="Пространство">
      <button type="button" className={mode === 'my' ? 'on' : ''} aria-pressed={mode === 'my'} onClick={() => onChange('my')}>Моя жизнь</button>
      <button type="button" className={mode === 'our' ? 'on' : ''} aria-pressed={mode === 'our'} onClick={() => onChange('our')}>Наша жизнь</button>
    </div>
  );
}
