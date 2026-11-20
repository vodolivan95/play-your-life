import { useUpcoming } from '../ourUpcoming';
import type { UpcomingPerson } from '../ourUpcoming';

const isImg = (v?: string) => !!v && /^(data:|https?:|blob:|\/|\.\/)|\.(webp|png|jpe?g|gif|svg|avif)(\?.*)?$/i.test(v);

function Face({ p }: { p: UpcomingPerson }) {
  return <span className="pyl-up-face" title={p.name}>{isImg(p.photo) ? <img src={p.photo} alt="" /> : p.photo ? <i>{p.photo}</i> : (p.name.trim()[0] ?? '?').toUpperCase()}</span>;
}

/** «Ближайшие» в левом меню «Нашей жизни»: два ближайших мероприятия общего календаря. */
export default function OurUpcoming({ onCalendar }: { onCalendar: () => void }) {
  const { items, open } = useUpcoming();
  return (
    <section className="pyl-up" aria-label="Ближайшие мероприятия">
      <div className="pyl-up-head">
        <strong>🗓️ Ближайшие</strong>
        <button type="button" onClick={onCalendar}>Календарь ›</button>
      </div>
      {items.length === 0 ? <p className="pyl-up-empty">Мероприятий пока нет. Добавьте их в «Общем календаре».</p> : items.map((x) => {
        const d = new Date(x.start);
        const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        return (
          <button key={`${x.id}${x.start}`} type="button" className="pyl-up-item" style={{ ['--c' as string]: x.color }} onClick={() => open(x.id)}>
            <span className="pyl-up-date"><small>{d.toLocaleDateString('ru-RU', { weekday: 'short' })}</small><b>{d.getDate()}</b><small>{d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '')}</small></span>
            <span className="pyl-up-text">
              <strong><i aria-hidden="true">{x.icon}</i> {x.title}</strong>
              <small>🕖 {time}{x.place ? ` · 📍 ${x.place}` : ''}</small>
              {x.people.length > 0 && <span className="pyl-up-people">{x.people.map((p) => <Face key={p.name} p={p} />)}</span>}
            </span>
          </button>
        );
      })}
    </section>
  );
}
