/**
 * 3D-модели товаров магазина. Файлы лежат в `public/models/shop/`.
 * Товар без модели показывается прежней картинкой.
 */
export const shopModels: Partial<Record<string, { file: string; source: string }>> = {
  coffee: { file: 'coffee.glb', source: 'Модель предоставлена пользователем (coffee3.blend), конвертирована scripts/blend2glb' },
};
export function shopModelFile(itemId: string) {
  return shopModels[itemId]?.file ?? null;
}
