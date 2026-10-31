import { useState } from 'react';
import type { GameState } from '../game.ts';
import { yearKey, yearReport } from '../yearReport.ts';
import './HomeYearSummary.css';

export type HomeYearSummaryProps = {
  state: GameState;
  onSphere: (id: string) => void;
};

/** Компактный годовой срез для Главной. Компонент не изменяет GameState. */
export function HomeYearSummary({ state, onSphere }: HomeYearSummaryProps) {
  const [selectedYear, setSelectedYear] = useState(() => yearKey());
  const report = yearReport(state, selectedYear);
  const endLabel = report.current ? 'Сейчас' : 'В конце года';
  const kpis = [
    { label: 'XP за год', value: String(report.xp), unit: 'XP', note: 'все игровые источники XP' },
    { label: 'Задач выполнено', value: String(report.quests), unit: '', note: 'только игровые задания' },
    { label: 'Проектов достигнуто', value: String(report.goals), unit: '', note: 'события достижения проекта' },
    { label: 'Активных дней', value: String(report.activeDays), unit: `из ${report.daysPassed}`, note: report.activeDays ? 'дни с игровой активностью' : 'пока нет игровых дней' },
    {
      label: 'Привычки',
      value: report.habits.rate === null ? '—' : `${report.habits.rate}%`,
      unit: '',
      note: report.habits.rate === null ? 'нет плановых дней' : `${report.habits.totalMade} из ${report.habits.totalDue} отметок`,
    },
  ];

  return (
    <section className="hys home-year-summary" aria-labelledby="home-year-summary-title">
      <div className="hys-hero">
        <div className="hys-main">
          <div className="hys-topline">
            <span className="hys-pill">ИТОГИ ГОДА · {report.current ? 'ИДЁТ' : 'ЗАВЕРШЁН'}</span>
            {report.availableYears.length > 1 && (
              <label className="hys-select-label">
                <span>Период</span>
                <select aria-label="Выбрать год отчёта" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
                  {report.availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
            )}
          </div>
          <h2 id="home-year-summary-title">{report.label}</h2>
          <p>{report.hasRecordedData ? 'Твой год в игровых действиях, привычках и оценках сфер.' : 'Здесь появится годовой срез, когда будут первые игровые действия или плановые привычки.'}</p>
          <div className="hys-days">
            <div><span>Прошло {report.daysPassed} из {report.daysTotal} дн.</span><span>{report.current ? `до конца года ${report.daysLeft} дн.` : 'год завершён'}</span></div>
            <div className="hys-track" role="progressbar" aria-label={`Прогресс ${report.label}: прошло дней`} aria-valuemin={0} aria-valuemax={report.daysTotal} aria-valuenow={report.daysPassed}>
              <i style={{ width: `${report.daysProgress}%` }} />
            </div>
          </div>
        </div>

        <div className="hys-balance">
          <div className="hys-ring" role="img" aria-label={report.balance ? `Баланс сфер ${endLabel.toLowerCase()}: ${report.balance.after.toFixed(1)} из 10` : 'Баланс сфер пока неизвестен'}>
            <svg viewBox="0 0 220 220" aria-hidden="true">
              <circle cx="110" cy="110" r="90" className="hys-ring-bg" />
              <circle cx="110" cy="110" r="90" className="hys-ring-fg" strokeDasharray={`${(report.balance?.after ?? 0) / 10 * 565} 565`} transform="rotate(-90 110 110)" />
            </svg>
            <div><b>{report.balance ? report.balance.after.toFixed(1) : '—'}</b><span>баланс сфер</span></div>
          </div>
          <div className="hys-balance-copy">
            <span>{endLabel}</span>
            {report.balance ? (
              <><b>{report.balance.after.toFixed(1)} / 10</b><small>В начале года: {report.balance.before.toFixed(1)}</small></>
            ) : (
              <><b>Нет полной оценки</b><small>Нужны реальные оценки всех 10 сфер в начале и в конце периода.</small></>
            )}
          </div>
        </div>

        <div className="hys-kpis">
          {kpis.map((kpi) => (
            <div key={kpi.label}>
              <span>{kpi.label}</span>
              <b>{kpi.value}<small>{kpi.unit}</small></b>
              <em>{kpi.note}</em>
            </div>
          ))}
        </div>
      </div>

      {report.partial && (
        <p className="hys-note">ⓘ Подробный учёт задач, проектов и оценок сфер {report.trackingSince ? `ведётся с ${new Date(report.trackingSince).toLocaleDateString('ru-RU')}` : 'ещё не начат'}. Часть ранних записей года может быть неполной; XP из сохранённой истории включён.</p>
      )}

      <section className="hys-card hys-spheres" aria-labelledby="home-year-spheres-title">
        <header>
          <div>
            <h3 id="home-year-spheres-title">Задания по сферам</h3>
            <p>Количество — выполненные игровые задания за {report.year}. Доля и полоса считаются от их общего числа, а не от XP.</p>
          </div>
          <span className="hys-source">Ручные итоги не входят в счётчик</span>
        </header>
        <div className="hys-sphere-list">
          {report.sphereRows.map((sphere) => (
            <div className="hys-sphere-row" key={sphere.id} style={{ ['--sphere' as string]: sphere.color }}>
              <button className="hys-sphere-name" onClick={() => onSphere(sphere.id)} aria-label={`Открыть сферу ${sphere.name}`}>
                <i aria-hidden="true" />
                <span>{sphere.name}</span>
              </button>
              <div className="hys-months" aria-label={`Выполненные игровые задания по месяцам: ${sphere.name}`}>
                {sphere.months.map((count, index) => (
                  <span key={index} className={count ? 'done' : ''} title={`${report.months[index].label}: ${count} заданий`} />
                ))}
              </div>
              <div className="hys-sphere-track" role="progressbar" aria-label={`Доля игровых заданий: ${sphere.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={sphere.share}>
                <i style={{ width: `${sphere.share}%` }} />
              </div>
              <strong>{sphere.tasks}<small>зад.</small></strong>
              <b>{sphere.share}%</b>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

export default HomeYearSummary;
