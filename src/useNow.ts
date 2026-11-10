import { useEffect, useState } from 'react';

/** Текущее время, обновляемое раз в секунду, пока `active`. Само время сессии считается от сохранённых моментов, а не этим тиком. */
export function useNow(active: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const first = setTimeout(() => setNow(new Date()), 0);
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [active]);
  return now;
}
