# Замена фотографий зданий в UI

Реестр: `src/sphereAssets.ts`. Новые оригиналы находятся в `src/assets/sphere-buildings/`: Восемь JPEG-файлов пользователя скопированы без изменения байтов, размеров и повторного сжатия. Фотография Досуга обработана для повышения чёткости через imagegen: WebP без потерь 1530×1028, PNG-мастер сохранён в `src/assets/masters/leisure-building-enhanced.png` и не загружается приложением. Генеративная обработка может изменить отдельные мелкие детали; композиция, главное здание и надписи сохранены. Один файл каждой сферы используется и в карточках, и в обложке квеста; браузер кэширует общий URL.

## Соответствия

| ID | Сфера | Файл |
| --- | --- | --- |
| health | Здоровье | health-building.jpg |
| sport | Спорт | sport-building.jpg |
| growth | Саморазвитие | self-development-building.jpg |
| english | Английский | english-building.jpg |
| finance | Финансы | finance-building.jpg |
| together | Совместные задачи | joint-tasks-building.jpg |
| driving | Вождение | driving-building.jpg |
| tasks | Задачи | tasks-building.jpg |
| hobby | Досуг и хобби | leisure-building.webp |

Все девять сфер используют новые фотографии через единый реестр; фотографии игровой карты от них независимы.

## Аудит использования

- `HomeDashboard`: девять карточек на Главной через `CityBuildingArt`.
- `App`: карточки и шапка выбранной сферы через `SphereBuilding`.
- `SphereCity`: карусели сфер через `SphereBuilding`.
- `SpheresOverview`: ведущая/слабая сфера и карточки обзора через `SphereBuilding`.
- `QuestBoard`: выбор сфер и fallback-обложки квестов.
- `QuestWizard`: выбор сферы и fallback на шаге «Фотография».
- Цели, план жизни, итоги месяца, Skill Tree, достижения, магазин, статистика, профиль и проекты: отдельные фотографии зданий не найдены; существующие иконки, символы, пользовательские фото и иллюстрации сохранены. Картинки не добавлены.

## Исключения

`cityAssets` и `sphereAssets.cityBuilding` сохранены. `CoastalCity`, `LifeCity`, `LiveCityCanvas`, `cityLive/*`, фон/миниатюры/панорамы города, комнаты, координаты, транспорт, погода и освещение не изменены. `SphereIcon`, `GameArt`, `Icon`, English-иконка в `CityBuildingArt`, все CSS и игровые данные не изменены.

Старые файлы `buildings/*` и `quest-covers/*` сохранены. Скрипт `build-city-assets.py` создаёт прежние ресурсы карты, но не пишет в новую директорию UI-фотографий.
