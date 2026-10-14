/**
 * 3D-модели товаров магазина. Файлы лежат в `public/models/shop/`.
 * Товар без модели показывается прежней картинкой.
 */
export const shopModels: Partial<Record<string, { file: string; source: string }>> = {
  icecream: { file: 'icecream.glb', source: 'Авторская процедурная модель (CC0), scripts/blend2glb/procedural.py' },
  coffee: { file: 'coffee.glb', source: 'Модель предоставлена пользователем (coffee3.blend), конвертирована scripts/blend2glb' },
  thermae: { file: 'thermae.glb', source: 'Авторская процедурная модель (CC0), scripts/blend2glb/procedural.py' },
  luxspa: { file: 'thermae.glb', source: 'Та же модель, что у «Похода в термы»: авторская процедурная модель (CC0)' },
  luxcourse: { file: 'trophy.glb', source: 'Кубок из набора 3D-спортзала (public/models/sport/trophy.glb, docs/ROOM-3D.md)' },
  luxtech: { file: 'exercise-bike.glb', source: 'Велотренажёр из набора 3D-спортзала (public/models/sport/exercise-bike.glb, docs/ROOM-3D.md)' },
  rest: { file: 'plant.glb', source: 'Растение из набора 3D-спортзала (public/models/sport/plant.glb, docs/ROOM-3D.md)' },
};
export function shopModelFile(itemId: string) {
  return shopModels[itemId]?.file ?? null;
}
