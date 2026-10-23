import { lazy, Suspense, useState } from 'react';
import type { Dispatch, SetStateAction, KeyboardEvent } from 'react';
import type { GameState } from '../game';
import { monthKey, monthLabel, moveMonth, validMonth } from '../monthly';
import MonthReport from './MonthReport';
import MyResults from './MyResults';
import './MyResults.css';
import './MonthReport.css';
import './KeyResults.css';

const VictoryResults = lazy(() => import('./PersonalResultsViews').then((module) => ({ default: module.VictoryResults })));
const PersonalDynamics = lazy(() => import('./PersonalResultsViews').then((module) => ({ default: module.PersonalDynamics })));
const YearResults = lazy(() => import('./PersonalResultsViews').then((module) => ({ default: module.YearResults })));

type Tab = 'report' | 'mine' | 'victory' | 'dynamics' | 'year';
const tabs: { id: Tab; label: string; hint: string }[] = [
  { id: 'report', label: 'Отчёт месяца', hint: 'Факты и графики' },
  { id: 'mine', label: 'Мои итоги', hint: 'Выводы и планы' },
  { id: 'victory', label: 'Ключевой результат', hint: 'Личные победы' },
  { id: 'dynamics', label: 'Динамика', hint: 'Путь по месяцам' },
  { id: 'year', label: 'Итоги года', hint: 'Целый год по сферам' },
];

/** Пять представлений одной истории. Месяц не теряется при смене вкладки. */
export default function KeyResults({
  state, onChange, ownerId, notify, initialTab = 'report',
}: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  ownerId: string;
  notify: (text: string) => void;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [month, setMonth] = useState(monthKey);
  function openMonth(next: string) {
    if (!validMonth(next) || next > monthKey()) return;
    setMonth(next);
    setTab('mine');
  }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    setTab(tabs[next].id);
    document.getElementById(`kr-tab-${tabs[next].id}`)?.focus();
  }
  return (
    <div className="key-results kr-workspace">
      <div className="kr-navigation">
        <div className="myr-tabs kr-tabs" role="tablist" aria-label="Ключевые итоги">
          {tabs.map((item, index) => (
            <button key={item.id} id={`kr-tab-${item.id}`} role="tab" aria-selected={tab === item.id}
              aria-controls={`kr-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1}
              onKeyDown={(event) => tabKey(event, index)} onClick={() => setTab(item.id)}>
              <span className="kr-tab-label">{item.label}</span>
              <small>{item.hint}</small>
            </button>
          ))}
        </div>
        {tab !== 'year' && (
          <div className="kr-period-bar">
            <div className="kr-period">
              <button className="kr-arrow" aria-label="Предыдущий месяц" onClick={() => setMonth(moveMonth(month, -1))}>←</button>
              <label className="kr-month-picker">
                <span>{monthLabel(month)}</span>
                <input type="month" aria-label="Выбрать месяц итогов" value={month} max={monthKey()}
                  onChange={(event) => { if (validMonth(event.target.value) && event.target.value <= monthKey()) setMonth(event.target.value); }} />
              </label>
              <button className="kr-arrow" aria-label="Следующий месяц" disabled={month >= monthKey()}
                onClick={() => setMonth(moveMonth(month, 1))}>→</button>
            </div>
            <span className="kr-period-note">{month === monthKey() ? 'Месяц ещё идёт · промежуточные данные' : 'История выбранного месяца'}</span>
          </div>
        )}
      </div>
      <div className="kr-panel" id={`kr-panel-${tab}`} role="tabpanel" aria-labelledby={`kr-tab-${tab}`}>
        <Suspense fallback={<div className="kr-card kr-muted" role="status">Открываем твою историю…</div>}>
        {tab === 'report' && <MonthReport state={state} onChange={onChange} selectedMonth={month}
          onOpenMine={() => setTab('mine')} onOpenVictory={() => setTab('victory')} />}
        {tab === 'mine' && <MyResults state={state} onChange={onChange} ownerId={ownerId} notify={notify}
          selectedMonth={month} onOpenVictory={() => setTab('victory')} />}
        {tab === 'victory' && <VictoryResults state={state} onChange={onChange} month={month} onOpenMine={() => setTab('mine')} />}
        {tab === 'dynamics' && <PersonalDynamics state={state} month={month} onOpenMonth={openMonth} />}
        {tab === 'year' && <YearResults state={state} month={month} onOpenMonth={openMonth} />}
        </Suspense>
      </div>
    </div>
  );
}
