import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from '../game';
import { filledSpheres, reviewOf } from '../keyResults';
import { monthKey } from '../monthly';
import { spheres } from '../game';
import MonthlyReview from './MonthlyReview';
import MyResults from './MyResults';
import Statistics from './Statistics';
import './MyResults.css';

type Tab = 'report' | 'mine' | 'dynamics';

/** «Ключевые итоги»: отчёт месяца, «Мои итоги» (ввод итогов по сферам) и динамика. */
export default function KeyResults({
  state,
  onChange,
  ownerId,
  notify,
  storageError,
  initialTab = 'report',
}: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  ownerId: string;
  notify: (text: string) => void;
  storageError: boolean;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const filled = filledSpheres(reviewOf(state, monthKey()));
  const tabs: { id: Tab; label: string; badge?: string }[] = [
    { id: 'report', label: 'Отчёт месяца' },
    { id: 'mine', label: 'Мои итоги', badge: `${filled} из ${spheres.length}` },
    { id: 'dynamics', label: 'Динамика' },
  ];
  return (
    <div className="key-results">
      <div className="myr-tabs" role="tablist" aria-label="Ключевые итоги">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
            {t.badge && <span>{t.badge}</span>}
          </button>
        ))}
      </div>
      {tab === 'report' && (
        <MonthlyReview state={state} onChange={onChange} storageError={storageError} onSaved={() => notify('Итоги месяца сохранены')} />
      )}
      {tab === 'mine' && <MyResults state={state} onChange={onChange} ownerId={ownerId} notify={notify} />}
      {tab === 'dynamics' && <Statistics state={state} onMonthly={() => setTab('report')} />}
    </div>
  );
}
