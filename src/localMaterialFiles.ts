/** Файлы остаются на устройстве. В игру/Firestore передаются только метаданные. */
const database = 'pyl-project-files-v1';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Хранилище файлов недоступно. Разрешите хранение данных в браузере.'));
  });
}
export async function materialFile(owner: string, goal: string, id: string, action: 'get' | 'put' | 'delete', blob?: Blob): Promise<Blob | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', action === 'get' ? 'readonly' : 'readwrite');
    const store = tx.objectStore('files');
    const key = [owner, goal, id];
    const request = action === 'get' ? store.get(key) : action === 'delete' ? store.delete(key) : store.put(blob, key);
    tx.oncomplete = () => { db.close(); resolve(action === 'get' ? request.result as Blob | undefined : undefined); };
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('Не удалось сохранить файл на устройстве. Проверьте свободное место.')); };
  });
}
