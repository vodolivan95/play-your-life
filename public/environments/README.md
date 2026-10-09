# Материалы 3D-спортзала

`sport-stone.jpg` — нейтральная limestone baseColor, 1K; материал пола, не изображение интерьера. Normal/grout задаются отдельно.

За окнами `RoomEnvironment` использует `cityAssets.skyline` из `src/sphereAssets.ts` — вырезку актуального master-города; тон DAY/SUNSET/NIGHT задаётся материалом. Свет и отражения создаются отдельным RoomLighting / Environment. Камера, геометрия и предметы спортзала сохраняются. Неиспользуемые прежние панорамы удалены.
