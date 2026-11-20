import { useEffect, useState } from 'react';
import { askNotificationPermission, notificationPermission, psychologyReminderDue, showSystemNotification, weekKey } from '../systemNotify';
import './SystemReminders.css';

const PSY_KEY = 'pyl-psychology-friday';
const PROMPT_KEY = 'pyl-notify-prompt-dismissed';

/** Раз в неделю, в пятницу с 10:00: напоминание заняться психологией (системное уведомление + карточка в игре). */
export function PsychologyReminder({ onOpen }: { onOpen: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const check = () => {
      let last: string | null = null;
      try { last = localStorage.getItem(PSY_KEY); } catch { /* без localStorage напоминаем каждый раз */ }
      if (!psychologyReminderDue(new Date(), last)) return;
      try { localStorage.setItem(PSY_KEY, weekKey()); } catch { /* не важно */ }
      setShown(true);
      void showSystemNotification('🧠 Пятница — время для психологии', 'Загляни в «Психологию»: пара упражнений и запись в дневник.', '#open=psychology', 'psychology-friday');
    };
    check();
    const t = window.setInterval(check, 10 * 60 * 1000);
    window.addEventListener('focus', check);
    return () => { clearInterval(t); window.removeEventListener('focus', check); };
  }, []);
  if (!shown) return null;
  return (
    <aside className="sys-card" role="status">
      <span className="sys-card-icon" aria-hidden="true">🧠</span>
      <span className="sys-card-text"><b>Пятница — время для психологии</b><small>Пара упражнений и запись в дневник.</small></span>
      <button type="button" className="sys-card-go" onClick={() => { setShown(false); onOpen(); }}>Открыть</button>
      <button type="button" className="sys-card-close" aria-label="Закрыть" onClick={() => setShown(false)}>×</button>
    </aside>
  );
}

/** Одноразовое предложение включить уведомления (если браузер их поддерживает и разрешение ещё не спрашивали). */
export function NotifyPrompt({ owner }: { owner: boolean }) {
  const [open, setOpen] = useState(() => {
    try { return notificationPermission() === 'default' && !localStorage.getItem(PROMPT_KEY); } catch { return false; }
  });
  if (!open) return null;
  const close = () => { try { localStorage.setItem(PROMPT_KEY, '1'); } catch { /* не важно */ } setOpen(false); };
  return (
    <aside className="sys-card sys-prompt" role="dialog" aria-label="Уведомления">
      <span className="sys-card-icon" aria-hidden="true">🔔</span>
      <span className="sys-card-text"><b>Включить уведомления?</b><small>Задачи и статьи от второго участника, сообщения «Нашей жизни»{owner ? ', напоминание о психологии по пятницам' : ''}, сроки задач.</small></span>
      <button type="button" className="sys-card-go" onClick={async () => { const ok = await askNotificationPermission(); close(); if (ok) void showSystemNotification('PLAY YOUR LIFE 2.0', 'Уведомления включены ✅'); }}>Включить</button>
      <button type="button" className="sys-card-close" aria-label="Не сейчас" onClick={close}>×</button>
    </aside>
  );
}
