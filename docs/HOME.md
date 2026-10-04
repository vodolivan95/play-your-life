# Главная страница

Главная переделана по документу «1 правки Pley your live (Главное меню)».

- Логотип с короной и подписью «Твоя жизнь. Твоя игра.». Город и подпись внизу бокового меню на всех страницах; на телефоне — внизу страницы.
- Приветствие с горным пейзажем, кнопка продолжения игры, аватар, уровень, XP, монеты, серия дней и достижения из текущего профиля.
- Девять существующих сфер со зданиями города и отдельными маленькими иконками. Общие улучшения зданий отображаются и на главной.
- Квесты на сегодня, расписание из сохранённых дат задач, главная цель и активность текущей недели. Время не придумывается для задач без расписания.
- Пользователь выбирает награду из магазина и видит накопленные Life Coins. Выбор сохраняется в профиле и резервной копии; монеты списываются только при покупке в магазине.
- Текущая дата по московскому времени, уведомление о незавершённых квестах, баланс, уровень и вход в профиль в верхней панели.
- Погода в Люберцах: ссылка на присланный прогноз Яндекса, подготовлено автоматическое получение через сервер Яндекс Погоды. До подключения сервера температура не выдумывается.

## Будущее подключение TickTick

По просьбе пользователя синхронизация пока не настраивается. Основной экран показывает реальные задачи игры и статус существующего подключения, а блок привычек сообщает, что трекер ещё не подключён.

Зафиксирована следующая логика для отдельного этапа:

1. Получать дневные задачи из TickTick после настройки OAuth-сервера; учитывать даты начала и окончания и часовой пояс.
2. Хранить соответствие удалённого task ID и игрового quest ID, чтобы повторное получение не создавало дубликаты и повторные награды.
3. Отметку выполнения из приложения передавать обратно в TickTick. Показывать ожидающую отправку/ошибку при отсутствии сети и повторять отправку без повторного начисления XP.
4. Получать привычки и отметки дня отдельно от задач, после подтверждения доступного способа работы с привычками TickTick. Не создавать вымышленные привычки и не обозначать синхронизацию выполненной до подключения.

Существующая интеграция описана в [TICKTICK.md](TICKTICK.md); её сервер и авторизация в этой правке не изменяются.

## Фоновое изображение

Режим: новая генерация встроенным image_gen. Файл: src/assets/home-mountains.webp (2048 × 768, WebP). Точный промпт:

> Use case photorealistic-natural. Create a wide panoramic hero background for a Russian personal-development game dashboard. A realistic seated adult hiker seen from behind in a dark blue outdoor jacket with backpack occupies the far right third, looking over a beautiful calm alpine lake, pine forest and mountain peaks under soft warm morning light. The left two-thirds is an uncluttered lake/sky landscape with gentler contrast suitable for dark navy interface text overlays. Inspirational peaceful atmosphere, high-end travel photography, natural colors, crisp but not oversaturated, 8:3 landscape composition. No text, no logos, no UI, no buttons, no borders.

## Проверки

npm run check, npm test; браузерная проверка выбора и сохранения награды, выполнения квеста, переходов, погоды, отсутствия ошибок и переполнения на 320/390/768/1024/1440 px.

## Персонаж ближе к зрителю

По отдельной правке пользователя персонаж на фоне увеличен и перенесён на передний план; поза сидя и пейзаж сохранены. На телефоне кадр смещён вправо, чтобы персонаж попадал в видимую область. Файл заменён: src/assets/home-mountains.webp. Режим: редактирование встроенным image_gen. Промпт:

> Edit the supplied panoramic mountain hero photograph. Make only one composition change: move the same seated male hiker much closer to the camera and enlarge him by about 1.6 times. He must remain seated on the foreground rock at the right, viewed from behind with the same blue outdoor jacket, dark trousers and blue backpack, looking toward the alpine lake. Show his head, shoulders, backpack and bent legs prominently; his seated silhouette should occupy approximately 80 percent of the image height and the rightmost 32 percent of the image, with the head around 78 percent of the width. Preserve the existing lake, mountains, pine forest, warm sunrise, natural photographic style and overall wide panoramic 8:3 canvas. Keep the left 65 percent spacious and unobstructed for dashboard text. Do not add text, logos, UI or extra people. Keep realistic anatomy and a clearly seated posture. The character should feel close to the viewer, in the immediate foreground.
## Меню и ширина экрана

Меню повторяет первый присланный образец: оригинальные логотип с короной, город и нижняя подпись отображаются прямо из исходного изображения без перерисовки. Список заменён на 12 действующих разделов из второго образца. Голубое выделение перемещается на выбранный раздел, счётчик квестов берётся из игры. Подпись «Твоё приключение» и отдельный нижний профиль убраны в соответствии с образцом; профиль остаётся в списке разделов и верхней панели.

На компьютере меню занимает высоту окна, все ссылки и изображение доступны без прокрутки меню. Страница занимает ширину окна за вычетом меню. На телефоне ширина равна ширине устройства; используется существующая нижняя навигация. Проверены 1920×1080, 1440×900, 1366×768, 1280×720, 1024×600, 768×1024 и мобильные 320/390/430 px.

## Источник погоды — Яндекс

Источник изменён на присланную страницу: https://yandex.ru/pogoda/ru/lubercy?lat=55.669663&lon=37.907137. Open-Meteo больше не запрашивается. Пока сервер с ключом Яндекса не подключён, блок открывает эту страницу и не показывает выдуманную температуру.

Для автоматического отображения задайте VITE_YANDEX_WEATHER_URL — адрес своего серверного endpoint, который возвращает JSON с fact.temp, fact.condition, fact.daytime и fact.obs_time из официального API Яндекса для координат 55.669663 / 37.907137. Сервер должен разрешать CORS для адреса приложения. Ключ X-Yandex-Weather-Key хранится только на сервере, его нельзя помещать в VITE-переменные или репозиторий. Клиент проверяет свежесть и формат ответа, обновляет погоду каждые 10 минут и при ошибке сохраняет ссылку на прогноз.

Документация: https://yandex.com/dev/weather/doc/ru/concepts/api, https://yandex.com/dev/weather/doc/ru/concepts/forecast-rest. Сервер и платный тариф в этой правке не создаются.
