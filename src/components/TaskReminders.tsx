import { useEffect, useRef, useState } from 'react';
import type { Quest } from '../game';
import { dueTaskReminders } from '../taskReminders';
export default function TaskReminders({ tasks, onOpen }: { tasks: Quest[]; onOpen: (id: string) => void }) {
  const latest = useRef(tasks);
  useEffect(() => { latest.current = tasks; }, [tasks]);
  const fired = useRef(new Set<string>());
  const [alerts, setAlerts] = useState<ReturnType<typeof dueTaskReminders>>([]);
  useEffect(() => {
    function check() {
      const next = dueTaskReminders(latest.current, Date.now()).filter(r => !fired.current.has(r.key));
      if (!next.length) return;
      next.forEach(r => fired.current.add(r.key));
      setAlerts(old => [...old, ...next].slice(-10));
    }
    const interval = window.setInterval(check, 15000);
    check();
    window.addEventListener('focus', check);
    return () => { clearInterval(interval); window.removeEventListener('focus', check); };
  }, []);
  if (!alerts.length) return null;
  return <aside className="task-reminder-alerts" aria-label="Напоминания о задачах" aria-live="polite">
    {alerts.map(r => <div key={r.key}><button onClick={() => { onOpen(r.taskId); setAlerts(old => old.filter(x => x.key !== r.key)); }}>♧ {r.name}</button>
      <button aria-label={`Закрыть напоминание ${r.name}`} onClick={() => setAlerts(old => old.filter(x => x.key !== r.key))}>×</button></div>)}
  </aside>;
}
