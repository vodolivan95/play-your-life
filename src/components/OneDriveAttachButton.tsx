import { useState } from 'react';
import { auth } from '../firebaseClient';
import { friendlyError, GraphError, OneDriveClient } from '../oneDrive';
import type { DriveItem } from '../oneDrive';
import type { DriveLink } from '../oneDriveLinks';
import { DrivePicker } from './OneDriveDialogs';
import './OneDrivePage.css';

export default function OneDriveAttachButton({ mode = 'file', disabled, onSelect, notify }: { mode?: 'file' | 'folder'; disabled?: boolean; onSelect: (link: DriveLink) => void; notify: (text: string) => void }) {
  const [client, setClient] = useState<OneDriveClient>(), [busy, setBusy] = useState(false);
  async function choose() {
    const user = auth.currentUser;
    if (!user) { notify('Войдите в аккаунт Play Your Life, чтобы выбрать файл OneDrive.'); return; }
    const candidate = new OneDriveClient(async () => { if (auth.currentUser?.uid !== user.uid) throw new GraphError(401, 'Аккаунт изменился. Откройте выбор файла заново.'); return user.getIdToken(); });
    setBusy(true);
    try { const status = await candidate.status(); if (!status.connected) { notify('Сначала подключите OneDrive в разделе «Мой диск».'); return; } setClient(candidate); }
    catch (e) { notify(friendlyError(e)); } finally { setBusy(false); }
  }
  async function select(item: DriveItem) {
    try {
      const driveId = item.parentReference?.driveId || (await client!.graph<{ id: string }>('/me/drive')).id;
      onSelect({ driveId, itemId: item.id, name: item.name, folder: !!item.folder }); setClient(undefined);
    } catch (e) { notify(friendlyError(e)); }
  }
  return <><button disabled={disabled || busy} onClick={() => void choose()}>{busy ? 'Проверяем OneDrive…' : mode === 'folder' ? '＋ Папка OneDrive' : '＋ OneDrive'}</button>{client && <DrivePicker client={client} mode={mode} onClose={() => setClient(undefined)} onChoose={item => void select(item)} />}</>;
}
