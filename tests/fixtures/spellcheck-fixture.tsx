import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { enableNativeSpellcheck } from '../../src/spellcheck';
import '../../src/spellcheck.css';

export function SpellcheckFixture() {
  const [title, setTitle] = useState('');
  const [comments, setComments] = useState('');

  return (
    <main style={{ maxWidth: 480, margin: '40px auto', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Проверка орфографии</h1>
      <label style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
        Название задачи
        <input type="text" value={title} onChange={event => setTitle(event.target.value)} />
      </label>
      <label style={{ display: 'grid', gap: 8 }}>
        Комментарий
        <textarea rows={5} value={comments} onChange={event => setComments(event.target.value)} />
      </label>
    </main>
  );
}

enableNativeSpellcheck();
createRoot(document.getElementById('root')!).render(<SpellcheckFixture />);
