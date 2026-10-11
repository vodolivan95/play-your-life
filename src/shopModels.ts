/**
 * 3D-модели товаров магазина. Файлы лежат в `public/models/shop/`.
 * Товар без модели показывается прежней картинкой.
 */
export const shopModels: Partial<Record<string, { file: string; source: string }>> = {
  icecream: { file: 'icecream.glb', source: 'Авторская процедурная модель (CC0), scripts/blend2glb/procedural.py' },
  coffee: { file: 'coffee.glb', source: 'Модель предоставлена пользователем (coffee3.blend), конвертирована scripts/blend2glb' },
  thermae: { file: 'thermae.glb', source: 'Авторская процедурная модель (CC0), scripts/blend2glb/procedural.py' },
};
export function shopModelFile(itemId: string) {
  return shopModels[itemId]?.file ?? null;
}
