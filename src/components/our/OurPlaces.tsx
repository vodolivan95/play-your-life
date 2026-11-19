import { useEffect, useState } from 'react';
import { compressImage, matches, newId, notify, patch, placeCategories, placeStatuses, proposalStatuses, put, byTime, watch, dayKey } from '../../ourData';
import type { Ctx, Place, Visit } from '../../ourData';
import Ic from '../KbIcons';
import { EventForm } from './OurCalendar';
import OurThread from './OurThread';
import { Empty, Field, Linkify, Modal, Tabs } from './OurUi';
import { fmtDate, fmtDay, nameIn } from './ourFormat';

/* ---------- Наши места (ТЗ 7): каталог, предложения, обсуждение, «Запланировать», история посещений ---------- */

type Tab = 'all' | 'proposals' | 'want' | 'visited';
const proposalKinds: [string, string, keyof typeof placeCategories][] = [['cafe', 'Сходить в кафе', 'food'], ['concert', 'Посетить концерт', 'concerts'], ['movie', 'Посмотреть фильм', 'cinema'], ['walk', 'Организовать прогулку', 'parks'], ['weekend', 'Съездить на выходные', 'trips'], ['sight', 'Посетить достопримечательность', 'sights'], ['other', 'Другое мероприятие', 'other']];
const mapLink = (address: string) => `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`;

export default function OurPlaces({ ctx, focusId, onOpen }: { ctx: Ctx; focusId: string | null; onOpen: (page: string, id: string) => void }) {
  const who = nameIn(ctx.space);
  const [places, setPlaces] = useState<Place[]>([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [category, setCategory] = useState<'any' | Place['category']>('any');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<{ kind: Place['kind']; place?: Place } | null>(null);
  const [openId, setOpenId] = useState<string | null>(focusId);
  const [prevFocus, setPrevFocus] = useState(focusId);
  if (focusId !== prevFocus) { setPrevFocus(focusId); setOpenId(focusId); }
  useEffect(() => watch<Place>(ctx, 'places', byTime(500), setPlaces, setError), [ctx]);
  const list = places.filter((p) => (tab === 'all' ? p.kind === 'place' : tab === 'proposals' ? p.kind === 'proposal' : p.kind === 'place' && (tab === 'want' ? p.status !== 'visited' : p.status === 'visited'))
    && (category === 'any' || p.category === category) && (matches(p.title, q) || matches(p.description, q) || matches(p.address, q)));
  const open = places.find((p) => p.id === openId) ?? null;
  const count = (t: Tab) => places.filter((p) => (t === 'proposals' ? p.kind === 'proposal' && !['declined', 'done'].includes(p.proposalStatus) : t === 'want' ? p.kind === 'place' && p.status !== 'visited' : t === 'visited' ? p.kind === 'place' && p.status === 'visited' : p.kind === 'place')).length;

  return (
    <div className="op">
      {error && <p className="o-err">{error}</p>}
      <div className="ok-bar">
        <Tabs value={tab} onChange={setTab} items={[['all', 'Все места', count('all')], ['proposals', 'Предложения', count('proposals')], ['want', 'Хотим посетить', count('want')], ['visited', 'Посетили', count('visited')]]} />
        <div className="ok-filters">
          <button type="button" onClick={() => setForm({ kind: 'proposal' })}><Ic n="chat" size={15} /> Предложить</button>
          <button type="button" className="o-primary" onClick={() => setForm({ kind: 'place' })}><Ic n="plus" size={15} /> Место</button>
        </div>
      </div>
      <div className="ok-bar">
        <label className="o-search slim"><Ic n="search" size={15} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск мест и предложений" aria-label="Поиск мест" /></label>
        <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} aria-label="Категория"><option value="any">Все категории</option>{Object.entries(placeCategories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <span className="o-muted">Карта: адреса открываются в Яндекс Картах.</span>
      </div>
      {list.length === 0 ? <Empty icon="mapPin" title={tab === 'proposals' ? 'Предложений пока нет' : 'Мест пока нет'} text={tab === 'proposals' ? 'Предложите сходить в кафе, на концерт или съездить на выходные.' : 'Сохраните место, куда хочется сходить вместе.'} /> : (
        <div className="op-grid">{list.map((p) => (
          <button key={p.id} type="button" className="op-card" onClick={() => setOpenId(p.id)}>
            <span className="op-photo">{p.photos[0] ? <img src={p.photos[0]} alt="" loading="lazy" /> : <Ic n="mapPin" size={34} />}<em className={`op-status s-${p.kind === 'proposal' ? p.proposalStatus : p.status}`}>{p.kind === 'proposal' ? proposalStatuses[p.proposalStatus] : placeStatuses[p.status]}</em></span>
            <span className="op-body">
              <small>{placeCategories[p.category]}</small>
              <strong>{p.title}</strong>
              {p.description && <span className="op-desc">{p.description}</span>}
              <span className="op-meta">{p.address && <span><Ic n="mapPin" size={13} /> {p.address}</span>}{p.budget && <span>≈ {p.budget}</span>}</span>
              <span className="op-meta"><span>{who(p.authorId)} · {fmtDate(p.at)}</span>{p.commentsCount > 0 && <span><Ic n="comment" size={13} /> {p.commentsCount}</span>}{p.visits.length > 0 && <span>⭐ {(p.visits.reduce((s, v) => s + v.rating, 0) / p.visits.length).toFixed(1)}</span>}</span>
            </span>
          </button>
        ))}</div>
      )}
      {form && <PlaceForm ctx={ctx} kind={form.kind} place={form.place} onClose={() => setForm(null)} onSaved={(id) => { setForm(null); setOpenId(id); }} />}
      {open && !form && <PlaceCard ctx={ctx} p={open} onClose={() => setOpenId(null)} onEdit={() => setForm({ kind: open.kind, place: open })} onOpen={onOpen} />}
    </div>
  );
}

function PlaceForm({ ctx, kind, place, onClose, onSaved }: { ctx: Ctx; kind: Place['kind']; place?: Place; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState({ title: place?.title ?? '', description: place?.description ?? '', category: place?.category ?? 'food', address: place?.address ?? '', mapUrl: place?.mapUrl ?? '', site: place?.site ?? '', eventUrl: place?.eventUrl ?? '', budget: place?.budget ?? '', status: place?.status ?? 'want', photos: place?.photos ?? [], kindHint: 'cafe' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const id = useState(() => place?.id ?? newId(ctx, 'places'))[0];
  const set = (k: keyof typeof f, v: unknown) => setF({ ...f, [k]: v });
  const save = async () => {
    if (!f.title.trim()) { setError('Введите название.'); return; }
    setBusy(true);
    const data = { kind, title: f.title.trim().slice(0, 120), description: f.description.slice(0, 3000), category: f.category, address: f.address.slice(0, 200), mapUrl: f.mapUrl.slice(0, 500) || (f.address ? mapLink(f.address) : ''), site: f.site.slice(0, 500), eventUrl: f.eventUrl.slice(0, 500), budget: f.budget.slice(0, 60), photos: f.photos.slice(0, 3), status: f.status };
    try {
      if (place) await patch(ctx, 'places', id, data);
      else {
        await put(ctx, 'places', id, { ...data, proposalStatus: 'proposed', eventId: null, visits: [], commentsCount: 0 });
        void notify(ctx, kind === 'proposal' ? `предлагает: «${data.title}»` : `добавил(а) место «${data.title}»`, { page: 'our-places', id });
      }
      onSaved(id);
    } catch { setError('Не удалось сохранить: проверьте интернет. Если фото много — уберите одно.'); } finally { setBusy(false); }
  };
  return (
    <Modal title={place ? 'Изменить' : kind === 'proposal' ? 'Новое предложение' : 'Новое место'} onClose={onClose} wide footer={<>{error && <span className="o-err inline">{error}</span>}<button type="button" onClick={onClose}>Отмена</button><button type="button" className="o-primary" disabled={busy} onClick={() => void save()}>Сохранить</button></>}>
      <div className="of-grid">
        {kind === 'proposal' && !place && <Field label="Что предлагаю" wide><div className="o-pills">{proposalKinds.map(([k, l, c]) => <button key={k} type="button" className={f.kindHint === k ? 'on' : ''} onClick={() => setF({ ...f, kindHint: k, category: c, title: f.title || l })}>{l}</button>)}</div></Field>}
        <Field label="Название" wide><input value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={120} autoFocus /></Field>
        <Field label="Категория"><select value={f.category} onChange={(e) => set('category', e.target.value)}>{Object.entries(placeCategories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        {kind === 'place' && <Field label="Статус"><select value={f.status} onChange={(e) => set('status', e.target.value)}>{Object.entries(placeStatuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>}
        <Field label="Адрес"><input value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="Ссылка на карту"><input value={f.mapUrl} onChange={(e) => set('mapUrl', e.target.value)} placeholder="Подставится по адресу" /></Field>
        <Field label={kind === 'proposal' ? 'Ссылка' : 'Сайт'}><input value={f.site} onChange={(e) => set('site', e.target.value)} placeholder="https://…" /></Field>
        {kind === 'place' && <Field label="Ссылка на мероприятие"><input value={f.eventUrl} onChange={(e) => set('eventUrl', e.target.value)} placeholder="Афиша, билеты" /></Field>}
        <Field label="Примерный бюджет"><input value={f.budget} onChange={(e) => set('budget', e.target.value)} placeholder="3 000 ₽ на двоих" /></Field>
        <Field label="Описание" wide><textarea rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Фотографии (до 3)" wide>
          <div className="op-photos">
            {f.photos.map((ph, i) => <span key={i}><img src={ph} alt="" /><button type="button" aria-label="Убрать фото" onClick={() => set('photos', f.photos.filter((_, j) => j !== i))}><Ic n="close" size={12} /></button></span>)}
            {f.photos.length < 3 && <label className="op-add-photo"><Ic n="plus" size={18} /><input type="file" accept="image/*" hidden onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; try { set('photos', [...f.photos, await compressImage(file, 1000, 180_000)]); } catch (er) { setError((er as Error).message); } }} /></label>}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

function PlaceCard({ ctx, p, onClose, onEdit, onOpen }: { ctx: Ctx; p: Place; onClose: () => void; onEdit: () => void; onOpen: (page: string, id: string) => void }) {
  const who = nameIn(ctx.space);
  const [tab, setTab] = useState<'info' | 'talk' | 'visits'>('info');
  const [planning, setPlanning] = useState(false);
  const [visit, setVisit] = useState<Visit | null>(null);
  const plannedTwice = !!p.eventId;
  return (
    <Modal title={p.title} onClose={onClose} wide>
      <Tabs value={tab} onChange={setTab} items={[['info', p.kind === 'proposal' ? 'Предложение' : 'Место'], ['talk', 'Обсуждение', p.commentsCount], ['visits', 'Посещения', p.visits.length]]} />
      {tab === 'info' && (
        <div className="ok-detail">
          {p.photos.length > 0 && <div className="op-gallery">{p.photos.map((ph, i) => <a key={i} href={ph} target="_blank" rel="noreferrer"><img src={ph} alt="" /></a>)}</div>}
          <dl>
            <dt>Категория</dt><dd>{placeCategories[p.category]}</dd>
            <dt>Статус</dt><dd>
              {p.kind === 'proposal'
                ? <select value={p.proposalStatus} onChange={(e) => { void patch(ctx, 'places', p.id, { proposalStatus: e.target.value }); void notify(ctx, `«${p.title}» — ${proposalStatuses[e.target.value as keyof typeof proposalStatuses]}`, { page: 'our-places', id: p.id }); }} aria-label="Статус предложения">{Object.entries(proposalStatuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                : <select value={p.status} onChange={(e) => void patch(ctx, 'places', p.id, { status: e.target.value })} aria-label="Статус места">{Object.entries(placeStatuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
            </dd>
            {p.address && <><dt>Адрес</dt><dd>{p.address} · <a href={p.mapUrl || mapLink(p.address)} target="_blank" rel="noreferrer">на карте</a></dd></>}
            {p.site && <><dt>{p.kind === 'proposal' ? 'Ссылка' : 'Сайт'}</dt><dd><a href={p.site} target="_blank" rel="noreferrer">{p.site}</a></dd></>}
            {p.eventUrl && <><dt>Мероприятие</dt><dd><a href={p.eventUrl} target="_blank" rel="noreferrer">{p.eventUrl}</a></dd></>}
            {p.budget && <><dt>Бюджет</dt><dd>{p.budget}</dd></>}
            <dt>Добавил(а)</dt><dd>{who(p.authorId)} · {fmtDate(p.at)}</dd>
          </dl>
          {p.description && <p className="ok-desc"><Linkify text={p.description} /></p>}
          <div className="ok-actions">
            {plannedTwice
              ? <button type="button" className="o-primary" onClick={() => onOpen('our-calendar', p.eventId!)}><Ic n="calendar" size={15} /> Открыть мероприятие</button>
              : <button type="button" className="o-primary" onClick={() => setPlanning(true)}><Ic n="calendar" size={15} /> Запланировать</button>}
            <button type="button" onClick={() => { setVisit({ date: dayKey(new Date()), rating: 5, comment: '', by: ctx.uid }); setTab('visits'); }}>✓ Отметить посещение</button>
            <button type="button" onClick={onEdit}><Ic n="pencil" size={15} /> Изменить</button>
          </div>
        </div>
      )}
      {tab === 'talk' && <OurThread ctx={ctx} path={`places/${p.id}`} placeholder="Вопрос, дата, бюджет, ссылка…" onPosted={(t) => { void patch(ctx, 'places', p.id, { commentsCount: (p.commentsCount ?? 0) + 1, ...(p.kind === 'proposal' && p.proposalStatus === 'proposed' ? { proposalStatus: 'discussing' } : {}) }); void notify(ctx, `комментарий к «${p.title}»: ${t.slice(0, 60)}`, { page: 'our-places', id: p.id }); }} />}
      {tab === 'visits' && (
        <div className="ok-detail">
          {p.visits.length === 0 && !visit && <p className="o-muted">Посещений пока нет.</p>}
          <ul className="op-visits">{p.visits.map((v, i) => <li key={i}><strong>{fmtDay(v.date)}</strong> · {'★'.repeat(v.rating)}{'☆'.repeat(5 - v.rating)} · {who(v.by)}{v.comment && <p>{v.comment}</p>}{v.photo && <img src={v.photo} alt="" />}</li>)}</ul>
          {visit ? (
            <div className="op-visit-form">
              <div className="of-row"><Field label="Дата посещения"><input type="date" value={visit.date} onChange={(e) => setVisit({ ...visit, date: e.target.value })} /></Field>
                <Field label="Моя оценка"><div className="op-stars">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={n <= visit.rating ? 'on' : ''} aria-label={`${n} из 5`} onClick={() => setVisit({ ...visit, rating: n })}>★</button>)}</div></Field></div>
              <Field label="Комментарий"><textarea rows={2} value={visit.comment} onChange={(e) => setVisit({ ...visit, comment: e.target.value })} /></Field>
              <Field label="Фото"><input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setVisit({ ...visit, photo: await compressImage(f, 900, 150_000) }); }} /></Field>
              <div className="ok-actions"><button type="button" onClick={() => setVisit(null)}>Отмена</button><button type="button" className="o-primary" onClick={async () => { await patch(ctx, 'places', p.id, { visits: [...p.visits, visit], status: 'visited', ...(p.kind === 'proposal' ? { proposalStatus: 'done' } : {}) }); setVisit(null); }}>Сохранить посещение</button></div>
            </div>
          ) : <div className="ok-actions"><button type="button" onClick={() => setVisit({ date: dayKey(new Date()), rating: 5, comment: '', by: ctx.uid })}>✓ Отметить посещение</button>{p.status === 'visited' && <button type="button" className="o-primary" onClick={() => setPlanning(true)}>Запланировать снова</button>}</div>}
        </div>
      )}
      {planning && (
        <EventForm ctx={ctx} draft={{ title: p.title, description: p.description, place: p.title, address: p.address, mapUrl: p.mapUrl || (p.address ? mapLink(p.address) : ''), links: [p.site, p.eventUrl].filter(Boolean).join('\n'), category: p.category === 'trips' ? 'trips' : 'fun', access: 'shared', placeId: p.id }}
          onClose={() => setPlanning(false)}
          onSaved={async (eventId) => { setPlanning(false); await patch(ctx, 'places', p.id, { eventId, status: 'planned', ...(p.kind === 'proposal' ? { proposalStatus: 'agreed' } : {}) }); onOpen('our-calendar', eventId); }} />
      )}
    </Modal>
  );
}
