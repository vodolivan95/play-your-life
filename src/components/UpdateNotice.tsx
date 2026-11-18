import { useEffect, useState } from 'react';
import { seenVersionKey, shouldShowWhatsNew, versionFromHtml, whatsNew } from '../whatsNew';
import './UpdateNotice.css';

const current = () => (typeof document === 'undefined' ? null : document.querySelector('meta[name="application-version"]')?.getAttribute('content') ?? null);
const readSeen = () => { try { return localStorage.getItem(seenVersionKey); } catch { return null; } };

/**
 * Чтобы изменения сайта было видно сразу: раз в 5 минут и при возвращении на вкладку
 * проверяется опубликованная версия. Если она новее открытой — внизу кнопка «Обновить».
 * После обновления один раз показывается окно «Что нового».
 */
export default function UpdateNotice() {
  const [fresh, setFresh] = useState<string | null>(null);
  // Автотесты браузера (navigator.webdriver) окно не видят, чтобы оно не перекрывало кнопки.
  const [showNews, setShowNews] = useState(() => !navigator.webdriver && shouldShowWhatsNew(current(), readSeen()));
  const version = current();

  useEffect(() => {
    if (!version) return;
    let stopped = false;
    const check = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}?version-check=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' });
        if (!response.ok) return;
        const published = versionFromHtml(await response.text());
        if (!stopped && published && published !== version) setFresh(published);
      } catch { /* нет сети — проверим позже */ }
    };
    const timer = setInterval(() => void check(), 5 * 60_000);
    const wake = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', wake);
    const first = setTimeout(() => void check(), 20_000);
    return () => { stopped = true; clearInterval(timer); clearTimeout(first); document.removeEventListener('visibilitychange', wake); };
  }, [version]);

  const closeNews = () => {
    try { if (version) localStorage.setItem(seenVersionKey, version); } catch { /* хранилище недоступно */ }
    setShowNews(false);
  };

  return (
    <>
      {fresh && (
        <div className="update-notice" role="status">
          <span>Вышла новая версия {fresh}. Обновите страницу, чтобы увидеть изменения.</span>
          <button type="button" onClick={() => window.location.reload()}>Обновить</button>
          <button type="button" className="update-notice-close" aria-label="Скрыть" onClick={() => setFresh(null)}>×</button>
        </div>
      )}
      {showNews && version && (
        <section className="whats-new" role="dialog" aria-label={`Что нового в версии ${version}`}>
          <header><b>Что нового · версия {version}</b><button type="button" aria-label="Закрыть" onClick={closeNews}>×</button></header>
          <ul>{whatsNew[version].map((line) => <li key={line}>{line}</li>)}</ul>
          <button type="button" className="whats-new-ok" onClick={closeNews}>Понятно</button>
        </section>
      )}
    </>
  );
}
