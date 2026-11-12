import { useState } from 'react';
import type { TaskDetails } from '../taskDetails';
import Icon from './Icon';
type Participant = NonNullable<TaskDetails['participants']>[number];
type ContactPicker = { select: (properties: string[], options: { multiple: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]> };

export default function TaskPeople({ details, locked, onUpdate, notify }: {
  details: TaskDetails; locked: boolean; onUpdate: (value: Partial<TaskDetails>) => boolean; notify: (message: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const people = details.participants ?? [];
  async function pick() {
    const contacts = (navigator as Navigator & { contacts?: ContactPicker }).contacts;
    if (!contacts) { setAdding(true); notify('Этот браузер не открывает телефонную книгу. Добавьте имя и телефон вручную.'); return; }
    setBusy(true);
    try {
      const chosen = await contacts.select(['name', 'tel'], { multiple: true });
      const added: Participant[] = [];
      for (const c of chosen) {
        const name = (c.name?.[0] || c.tel?.[0] || '').trim().slice(0, 100);
        const phone = c.tel?.[0]?.slice(0, 50);
        if (!name || [...people, ...added].some(p => phone ? p.phone === phone : p.name === name)) continue;
        added.push({ id: crypto.randomUUID(), name, phone, role: 'participant' });
      }
      if (added.length) onUpdate({ participants: [...people, ...added] });
    } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) notify('Контакты недоступны. Можно добавить участника вручную.'); }
    finally { setBusy(false); }
  }
  return <section className="twin-card twin-people">
    <h3><Icon name="profile" size={24} /> Участники</h3>
    {people.length > 3 && <input aria-label="Поиск участников" placeholder="Имя или телефон" value={search} onChange={e => setSearch(e.target.value)} />}
    {people.filter(p => `${p.name} ${p.phone ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(p => <div className="twin-person" key={p.id}>
      <span className="twin-person-avatar" aria-hidden="true">{p.name.slice(0, 1)}</span>
      <span><strong>{p.name}</strong>{p.phone && <small>{p.phone}</small>}</span>
      <select aria-label={`Роль: ${p.name}`} value={p.role} disabled={locked} onChange={e => {
        const role = e.target.value as Participant['role'];
        onUpdate({ participants: people.map(person => person.id === p.id ? { ...person, role } :
          role === 'assignee' && person.role === 'assignee' ? { ...person, role: 'participant' } : person) });
      }}><option value="participant">Участник</option><option value="assignee">Исполнитель</option></select>
      <button type="button" disabled={locked} aria-label={`Удалить участника ${p.name}`} onClick={() => onUpdate({ participants: people.filter(x => x.id !== p.id) })}>×</button>
    </div>)}
    {!people.length && <p className="twin-empty">Добавьте тех, кто участвует в задаче.</p>}
    {!locked && <>
      <div className="twin-inline"><button type="button" disabled={busy} onClick={() => void pick()}>＋ Из телефонной книги</button>
        <button type="button" onClick={() => setAdding(!adding)}>＋ Новый контакт</button></div>
      {adding && <form className="twin-contact-form" onSubmit={e => {
        e.preventDefault();
        if (!name.trim()) return;
        if (onUpdate({ participants: [...people, { id: crypto.randomUUID(), name: name.trim(), phone: phone.trim() || undefined, role: 'participant' }] })) {
          setName(''); setPhone(''); setAdding(false);
        }
      }}><label>Имя<input autoFocus required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Телефон<input type="tel" maxLength={50} value={phone} onChange={e => setPhone(e.target.value)} /></label>
        <button type="submit">Добавить участника</button><button type="button" onClick={() => setAdding(false)}>Отмена</button></form>}
      <small>Контакты сохраняются в задаче. Приглашения и сообщения не отправляются.</small>
    </>}
  </section>;
}
