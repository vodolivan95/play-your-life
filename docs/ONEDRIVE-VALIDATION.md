# Проверка «Мой диск» 0.86.1

Продолжение PR #337 по Issue #338. База main: `00bffe545fbed1f7a9d1c1d331010f3813470e3e`; прежний head PR: `0b4e7ff0760e938ce6eff382afcb4bab5d547fcc`.

## Результат

Реализован серверный модуль OneDrive с MSAL/PKCE, шифрованием и проверкой Firebase UID. Раскладка папок адаптирована по скриншоту пользователя от 17 ноября: две крупные плитки на телефоне, счётчик внутри, подпись/дата/⋯ снизу. Снимки на тестовых метаданных: [светлый](design/onedrive-folders-mobile.png) и [тёмный](design/onedrive-folders-mobile-dark.png). Они не показывают личные файлы пользователя.

Архитектура, реализованные функции, переменные, настройка Entra, локальный запуск, развёртывание и live-матрица: [ONEDRIVE.md](ONEDRIVE.md).

## Фактически выполненные проверки

| Проверка | Результат |
| --- | --- |
| npm run check | Пройден: ESLint, frontend/оба Worker typecheck, production build. |
| npm run check:budgets | Пройден: стартовый JS 403,8 КБ из 420; суммарные JS/CSS 1034,5 КБ из 1040 gzip. |
| npm test | 654/654, без пропусков. |
| Профильные OneDrive + quality gates после последних правок | 14/14. |
| OneDrive UI (изолированные сервисные фикстуры) | 1440/768/390/320 px: страницы 100+ файлов, сортировка, две колонки, расположение меню, папки, безопасный Markdown, перенос/удаление, upload, fallback search, offline, 403, отключение и второй UID. Светлая/тёмная темы, без горизонтального переполнения. |
| TaskWindow UI | Шесть ширин: вкладки, вложения/описание, сохранение/перезагрузка, проект, статусы, заметки и история — пройден. |
| Project UI | Проверка выполняется; окончательный результат будет в PR/CI. |
| Cloudflare bundle | Wrangler 4.147.0 dry-run — пройден, около 117 КБ gzip. |
| Cloudflare runtime | workerd запущен локально, /status вернул предусмотренный 503 «Сервер OneDrive ещё не настроен». Compatibility date согласована с бинарником 2026-10-08. Реальный OAuth здесь не выполнялся. |
| GitHub Actions | Результат Project checks следует проверять на финальном head PR #337. |

Параллельный запуск браузерных проверок вместе с полной сборкой в ограниченном окружении дал таймауты Playwright; OneDrive успешно перепроверен отдельно. Это не было объявлено успешным Microsoft OAuth. Фикстуры MSAL/Graph не подтверждают работу с реальным Microsoft-аккаунтом.

## Что осталось владельцу

Entra ещё не зарегистрирован. Нужны реальная Web-регистрация, делегированное Files.ReadWrite, client secret в серверном Secret Store, ключ AES-GCM, Worker URL и VITE_ONEDRIVE_BRIDGE_URL. После настройки требуется live-вход, silent refresh, загрузка/просмотр реальных тестовых файлов и два разных пользователя. До этого модуль нельзя считать полностью проверенным. Слияние main и production-публикация не выполнялись.

## Файлы PR относительно main

- `.github/workflows/ci.yml`
- `.github/workflows/onedrive.yml`
- `.github/workflows/pages.yml`
- `.gitignore`
- `AGENTS.md`
- `CHANGELOG.md`
- `README.md`
- `docs/ONEDRIVE.md`
- `docs/design/onedrive-folders-mobile-dark.png`
- `docs/design/onedrive-folders-mobile.png`
- `eslint.config.js`
- `index.html`
- `integrations/onedrive/security.ts`
- `integrations/onedrive/tsconfig.json`
- `integrations/onedrive/worker.ts`
- `integrations/onedrive/wrangler.toml`
- `package-lock.json`
- `package.json`
- `scripts/check-budgets.mjs`
- `src/App.tsx`
- `src/components/MobileNav.tsx`
- `src/components/OneDriveAttachButton.tsx`
- `src/components/OneDriveDialogs.tsx`
- `src/components/OneDriveFolder.tsx`
- `src/components/OneDrivePage.css`
- `src/components/OneDrivePage.tsx`
- `src/components/ProjectMaterials.tsx`
- `src/components/TaskWindow.tsx`
- `src/menuIcons.ts`
- `src/navigation.ts`
- `src/oneDrive.ts`
- `src/oneDriveLinks.ts`
- `src/projectMaterials.ts`
- `src/taskDetails.ts`
- `tests/logo-ui.mjs`
- `tests/onedrive-ui.mjs`
- `tests/onedrive-worker.test.ts`
- `tests/onedrive.test.ts`
- `docs/ONEDRIVE-VALIDATION.md`
