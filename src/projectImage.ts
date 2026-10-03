/** Small raster previews only: never persist the original multi-megabyte photo. */
export function validProjectImage(value: unknown): value is string | undefined {
  return (
    value === undefined ||
    (typeof value === 'string' &&
      value.length <= 160000 &&
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))
  );
}
export async function readProjectImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/'))
    throw new Error('Выбери картинку или фотографию.');
  if (file.size > 20 * 1024 * 1024)
    throw new Error('Выбери изображение размером до 20 МБ.');
  const url = URL.createObjectURL(file);
  try {
    const photo = new Image();
    photo.src = url;
    try {
      await photo.decode();
    } catch {
      throw new Error(
        'Не удалось прочитать картинку. Попробуй JPG, PNG или WebP.',
      );
    }
    const size = Math.min(photo.naturalWidth, photo.naturalHeight);
    if (!size) throw new Error('В этом файле нет изображения.');
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx)
      throw new Error(
        'Не удалось подготовить картинку. Попробуй другой браузер.',
      );
    ctx.fillStyle = '#eaf6fe';
    ctx.fillRect(0, 0, 256, 256);
    ctx.drawImage(
      photo,
      (photo.naturalWidth - size) / 2,
      (photo.naturalHeight - size) / 2,
      size,
      size,
      0,
      0,
      256,
      256,
    );
    const image = canvas.toDataURL('image/jpeg', 0.85);
    if (!validProjectImage(image))
      throw new Error(
        'Не удалось уменьшить картинку. Выбери другое изображение.',
      );
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
