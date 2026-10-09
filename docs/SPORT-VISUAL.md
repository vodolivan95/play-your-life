# SPORT: визуальное улучшение 3D

## Аудит исходной версии

Renderer — WebGLRenderer Three.js 0.180, React Three Fiber 9, drei 10. Стек подходит для браузера/PWA, менять движок не требуется. Сцена действительно трехмерная. Исходные пол, стены, потолок, город и шесть предметов были процедурными геометриями. GLB-файлов не было; вспомогательный useGLTF существовал, но не был подключен к каталогу. Материалы — solid-color MeshStandardMaterial, стекло — MeshPhysicalMaterial. Свет — hemisphere, directional с shadow map 1024 и один point light. Камера OrbitControls с малой дистанцией 3–5.3 м давала слишком тесный технический ракурс. Город состоял из 18 прямоугольных зданий. Большие однотонные доски и отсутствие environment reflections усиливали ощущение прототипа.

Работали покупки с проверками уровня и Coins, инвентарь, координаты/повороты/масштаб, установка/перенос/возврат, quarter-turn AABB collision, проверка сохранений и прогресс установленного оснащения. Они сохранены. GameState.rooms участвует в обычных сохранениях/резервных копиях; отдельная демонстрация использует play-your-life-3d-sport-demo-v1 в localStorage. Старые целочисленные положения остаются валидными. Уровень открывает покупки и не устанавливает оборудование автоматически.

## Реализация

- RoomEngine — существующие состояние и транзакции; Shop/Inventory/RoomHUD — отдельные общие компоненты; RoomEnvironment — архитектура и PBR; RoomLighting — реальные источники света; RoomCamera — ограниченный перспективный обзор; RoomItemRenderer — ленивые GLB/резервные dev-модели; BuildSystem — пол/сетка/ghost. Данные и экономика комнат общие, код не копируется девять раз.
- Новый зал: каменный плиточный пол с созданной stone baseColor и процедурной normal текстурой, деревянные панели и рейки, темный металл, дверь, высокие потолочные балки, трековые светильники и теплые LED-линии. Пол/стены/стекло/балки остаются отдельными 3D-объектами.
- PBR: MeshStandardMaterial и MeshPhysicalMaterial, roughness/metalness/environment reflections; текстуры цвета sRGB, normal linear. Настоящие AO/roughness карты оборудования будут читаться из предоставленных glTF; они не выдумываются для отсутствующих ассетов.
- Environment lighting через Environment/Lightformer из drei, без сетевого HDR. Key/window directional, hemisphere fill, два теплых practical и слабый холодный accent. DAY/SUNSET/NIGHT меняют реальные интенсивности, цвета, exposure и городскую панораму. ACES tone mapping, правильный sRGB output.
- Один источник с динамической shadow map (1024 MEDIUM, 2048 HIGH); HIGH дополнительно ContactShadows на 2 кадра после изменения обстановки. LOW без тяжелых shadow maps, с легкими 64px статическими приближениями контактных теней под предметами. Стекло с низкой opacity без дорогой многоэтапной transmission.
- Город — три отдельно созданные генератором изображений панорамы дневного/закатного/ночного skyline, только за окнами. Пользовательские референсы не встроены в приложение. Интерьер и мебель настоящие 3D. Панорамы JPEG, примерно 2K, расположены на внешней плоскости окружения.
- Камера показывает больше зала; OVERVIEW/LEFT/CENTER/RIGHT — реальные плавные позиции. RESET CAMERA возвращает OVERVIEW. Pan выключен; дистанция, polar/azimuth, высота и границы помещения ограничены. Минимальная высота 2.2 м защищает от текущих низких предметов; высокие будущие GLB требуют дополнительной проверки camera bounding volumes до включения в каталог.
- Build Mode: невидимая сетка 0.5 м, голубой/красный ghost, footprint, bounds/clearance, rotation 90°. Нельзя пересекать стены и установленное оборудование. Confirm/Cancel выходят из установки, убирают ghost и сетку. При переносе исходный объект сохраняется до подтверждения.
- Отдельная CanvasTexture-поверхность экрана в консоли временной дорожки: SPORT и график, включение нажатием. Большой настенный Sports Display пока остается asset slot, не установлен автоматически в пустой комнате.
- Компактный темный HUD, почти полный viewport, безопасные отступы и viewport-fit=cover. Mobile — bottom sheet, desktop — правая панель. Ракурсы и reset доступны поверх сцены, контекстные действия только при выборе в Build Mode.
- Загрузка: PLAY YOUR LIFE, текст загрузки, фактический процент LoadingManager при наличии загрузок; CSS fade-in. Белого экрана нет.
- Новые npm-библиотеки не добавлены: имеющихся Three/R3F/drei достаточно. Bloom/SSAO пока не включены: приоритет базовым материалам и свету, стабильности мобильного устройства. Emissive и отражения дают акценты без размытия.
- AUTO по памяти/ядрам/coarse pointer; LOW DPR1, MEDIUM1.25, HIGH1.75. PerformanceMonitor при стабильном снижении ниже 24FPS переводит эффекты на LOW. Скрытая вкладка/reduced motion — demand rendering. Это защитный механизм, а не заявление о FPS на физических Android/iPhone.

## Asset pipeline

Сейчас **реальных производственных GLB нет**. Все шесть купленных объектов — **DEV PLACEHOLDER**, не финальные тренажеры. Статус доступен в настройках при `?room-demo=sport&room-dev=1`. Нет emoji/PNG-предметов внутри помещения. Ошибка загрузки отдельной модели оставляет резервную 3D-модель, не разрушает комнату.

Для подключения: положить лицензированный файл в public/models/sport, записать происхождение/лицензию, выставить available=true и license в assetSlots.ts. Только используемый установленный/ghost объект вызывает useGLTF. GLTFLoader поддерживает PBR и Meshopt; Draco требует локальных декодеров в public/decoders/draco (никакая внешняя CDN обязательной не является). Независимые экземпляры клонируются с материалами; ghost работает также для GLB. Pivot нормализуется на пол, превышение footprint уменьшается, авторские метры и Y-up обязательны. Проверить ориентацию, footprint, camera clearance и память перед включением. Для skinned/animated assets нужен SkeletonUtils и отдельный animation contract — текущая ветка рассчитана на статическую мебель.

| ASSET | FORMAT | REQUIRED QUALITY | APPROX POLYGON BUDGET (triangles) | TEXTURES | STATUS |
|---|---|---|---|---|---|
| Treadmill | GLB | realistic game-ready | 12–25k | PBR, 1K, emissive display | REQUIRED, dev placeholder |
| Dumbbells | GLB | realistic game-ready | 2–5k | PBR 512–1K | REQUIRED, dev placeholder |
| Bench | GLB | realistic game-ready | 5–10k | PBR 1K fabric/metal | REQUIRED, dev placeholder |
| Exercise ball | GLB | realistic game-ready | 2–4k | PBR 512 | REQUIRED, dev placeholder |
| Yoga mat | GLB | realistic game-ready | 1–2k | PBR 512–1K | REQUIRED, dev placeholder |
| Plant | GLB | realistic game-ready | 4–8k | PBR 1K, alpha leaves | REQUIRED, dev placeholder |
| Dumbbell rack | GLB | realistic game-ready | 8–15k | shared PBR 1K | REQUIRED, future slot |
| Kettlebells | GLB | realistic game-ready | 2–5k | shared PBR 512 | REQUIRED, future slot |
| Exercise bike | GLB | realistic game-ready | 10–20k | PBR 1K | REQUIRED, future slot |
| Boxing bag | GLB | realistic game-ready | 4–8k | PBR 1K | REQUIRED, future slot |
| Power rack | GLB | realistic game-ready | 10–20k | PBR 1K | REQUIRED, future slot |
| Functional trainer | GLB | realistic game-ready | 15–30k | PBR 1K–2K | REQUIRED, future slot |
| Trophy | GLB | realistic game-ready | 2–4k | PBR 512 | REQUIRED, future slot |
| Sports display | GLB | realistic game-ready | 2–5k | PBR 1K, emissive screen | REQUIRED, future slot |

Архитектурные геометрия/материалы переиспользуются; цвет камня 1K, город ~2K, остальные поверхности 256px.

Текстуры по возможности KTX2/Basis после подключения локального transcoder, ORM packed; до этого обычные встроенные JPG/PNG. Предпочтительно 1–3 материала на модель, 1K текстуры, размер GLB 0.3–2MB. Таблица — целевой бюджет, не число полигонов отсутствующих моделей. Случайные модели с неизвестной лицензией не добавлены. До получения GLB визуальный benchmark не считается окончательным.

## Проверки

Запускаются `npm run check`, `npm test` и существующая проверка Playwright WebGL в GitHub Actions для актуального коммита. Браузерный сценарий проверяет покупку за 800 Coins, поворот, коллизию, установку всех шести предметов, сохранение и перезагрузку, ракурсы, reset, мобильный viewport и день/ночь. Результат подтверждается для соответствующего коммита во вкладке Actions. Физические смартфоны не тестировались; эмуляция Chromium не доказывает реальные FPS и совместимость Safari.
