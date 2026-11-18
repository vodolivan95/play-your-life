import { useState } from 'react';
import { changeJournal, journalDate } from '../changeJournal';
import './ChangeJournal.css';

/** Раздел профиля «Журнал изменений»: версии, время правок, редактор и список изменений. */
export default function ChangeJournal() {
  const [all, setAll] = useState(false);
  const shown = all ? changeJournal : changeJournal.slice(0, 3);
  return (
    <section className="panel change-journal" aria-label="Журнал изменений">
      <ol>
        {shown.map((entry) => (
          <li key={entry.version}>
            <header>
              <b className="cj-version">v{entry.version}</b>
              <time dateTime={entry.at}>{journalDate(entry.at)}</time>
              <span className="cj-editor">Редактор: {entry.editor}</span>
            </header>
            <ul>
              {entry.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </li>
        ))}
      </ol>
      {changeJournal.length > 3 && (
        <button type="button" className="cj-more" onClick={() => setAll(!all)}>
          {all ? 'Свернуть' : `Показать все версии (${changeJournal.length})`}
        </button>
      )}
    </section>
  );
}
