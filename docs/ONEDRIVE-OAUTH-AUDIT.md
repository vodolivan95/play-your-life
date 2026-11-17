# OneDrive: AADSTS50020 и проверка авторизации, 0.86.2

Issue [#339](https://github.com/vodolivan95/play-your-life/issues/339), продолжение открытого [PR #337](https://github.com/vodolivan95/play-your-life/pull/337). Аудит выполнен 17 ноября 2026. Статус: **Код исправлен, требуется настройка Microsoft Entra**. Реальное устранение ошибки и вход в OneDrive пока не подтверждены.

## Установленная причина сообщения

Пользователь прямо подтвердил: ошибка с `74658136-14ec-4630-ad9b-26e160ff0fc6` появляется **при входе в entra.microsoft.com**, а не после кнопки OneDrive в Play Your Life. Это административный вход до регистрации нашего приложения. Вход личного Outlook в каталог `Microsoft Services` не даёт доступа к управлению приложениями без подходящего собственного каталога и прав. Microsoft описывает этот сценарий как Cause 1 в [разборе AADSTS50020](https://learn.microsoft.com/en-us/troubleshoot/entra/entra-id/app-integration/error-code-aadsts50020-user-account-identity-provider-does-not-exist).

Этот ID указан как **ADIbizaUX**, компонент административного портала Microsoft, в [разборе ошибки портала на Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/1858414/error-with-the-user-identity-aadsts16000). Это не идентификатор регистрации Play Your Life. Во время исходного аудита его не было в исходниках или настройке Client ID; теперь он присутствует только как запрещённый пример для защиты от ошибочного копирования ID из сообщения. В роли нашего OAuth client он не используется.

Пользователь может иметь собственный каталог, но войти в неверный контекст; отсутствие вообще всех каталогов за него не предполагается. Нужно переключиться в подходящий каталог с правом регистрации приложений либо сначала получить такой каталог. Добавлять Outlook как гостя в чужой `Microsoft Services` не требуется. Замена `consumers` на `common` в Play Your Life не исправляет административный вход в портал.

На момент аудита опубликованный main — 0.85.1 без модуля OneDrive; код OneDrive находится в открытом PR. В локальном окружении все Microsoft/OneDrive variables и secrets отсутствуют. Чтение GitHub repository variables через доступный CLI вернуло Forbidden, доступа к Entra/Cloudflare control plane нет. Поэтому фактические удалённые Client ID, signInAudience и redirect URI не объявляются проверенными.

## Аудит существующей цепочки

| Что | До исправления / итог |
| --- | --- |
| Microsoft OAuth | Один существующий `integrations/onedrive/worker.ts`, MSAL Node ConfidentialClientApplication. Вторая авторизация не создавалась. |
| Authorization URL | MSAL `getAuthCodeUrl`, Code Flow, PKCE S256; добавлен независимый OIDC nonce. |
| Client ID | Только server variable `MICROSOFT_CLIENT_ID`; реальное значение ещё требует регистрации. Новый guard проверяет UUID и отвергает ADIbizaUX. |
| Authority | Уже был `https://login.microsoftonline.com/consumers`, подходящий личным аккаунтам. `common` сохранён для личных + организационных. `organizations` теперь явно отвергается как несовместимый с обязательным личным OneDrive, с рекомендацией `common`. |
| Token endpoint | MSAL использует v2 token endpoint того же authority; собственный обмен и парольный flow не добавлены. |
| Redirect URI | `BRIDGE_URL + /callback`. Теперь BRIDGE_URL проверяется как точный origin, без пути/query/fragment/завершающего `/`; actual request origin должен совпасть. |
| Permissions | Files.ReadWrite уже был; User.Read добавлен для фактического GET /me и имени/почты. Реальный SDK автоматически добавляет openid/profile/offline_access, это проверено тестом. Только delegated scopes. |
| Callback | Сверяет state, одноразовый pending сроком 10 минут, PKCE verifier, HttpOnly cookie и nonce ID token. Ошибка сохраняется в зашифрованном состоянии пользователя, браузер возвращается на `#/drive` без токенов и provider error_description. |
| Проверка подключения | До сохранения новой связи выполняются только GET `/me?$select=id,displayName,mail,userPrincipalName`, `/me/drive?$select=id`, `/me/drive/root/children?$top=1&$select=id`. При неуспехе связь не принимается. Файлы не создаются/не переименовываются/не удаляются. |
| Токены | Весь MSAL cache, включая refresh token, остаётся AES-GCM зашифрованным в Durable Object проверенного Firebase UID. Client secret/ключ шифрования только в server secrets. |
| Silent refresh | acquireTokenSilent вызывается при защищённой операции и проверке status; обновлённый кеш сохраняется. Отозванный/истёкший доступ требует подключения; сетевой сбой возвращает временную ошибку и не удаляет связь. |
| Привязка | Namespace выбирается исключительно по подписанному Firebase JWT. ID диска, имя и почта приходят из проверенного Graph; настройки не берутся из подставленного uid. |
| Ошибки/логи | Раньше callback с error молча возвращался, а token exchange мог оставить JSON-ошибку. Теперь есть русское состояние ошибки, «Повторить подключение», safe diagnostic code/stage/internal correlation ID. Provider описания, JWT, code, refresh/access token и cookie не пишутся в лог. |
| Конфигурация | Защищённый GET `/diagnostics` возвращает только public Client ID, authority, callback URI, scopes и ошибки наличия/формата настройки. Доступен кнопкой в состоянии ошибки, требует текущий Firebase login, не выдаёт secrets. |

## Что изменено

| Файл | Изменение |
| --- | --- |
| `integrations/onedrive/auth.ts` | Scopes, проверка конфигурации, распознавание безопасных кодов, различение reauth/transient ошибок. |
| `integrations/onedrive/worker.ts` | Nonce, read-only Graph probes, безопасный возврат callback, проверка статуса/refresh, public diagnostics. |
| `src/oneDrive.ts` | Типы ответа соединения/диагностик, вызов существующего сервера. |
| `src/components/OneDrivePage.tsx` | Три состояния подключения, имя/почта/«Подключено», повторный вход и диагностика. Сетка папок и её порядок не менялись. |
| `src/components/OneDrivePage.css` | Только перенос длинных полей диагностик и ограничение их ширины. |
| `tests/onedrive-auth.test.ts` | Фактический MSAL URL/scopes/PKCE/nonce, защита Client ID/authority, отсутствие секретов. |
| `tests/onedrive-worker.test.ts` | Отказ при nonce mismatch, отказе Graph, плохом секрете, callback error; сохранение старого подключения при неуспехе; revoked/transient refresh, read-only probes, diagnostics. |
| `tests/onedrive-ui.mjs` | Connected/отключение/error/retry, read-only конфигурация, возврат формы в браузере ПК и mobile emulation; прежние файловые сценарии. |
| `.github/workflows/onedrive.yml` | Опциональный MICROSOFT_TENANT из repository variable, consumers по умолчанию. Автодеплой по-прежнему отключён до настройки владельца. |
| `docs/ONEDRIVE.md`, этот отчёт | Уточнены каталог администратора, permissions, ручные действия и границы проверки. |
| `package.json`, `package-lock.json`, `index.html`, `README.md`, `AGENTS.md`, `CHANGELOG.md` | Версия/состояние 0.86.2. Зависимости не добавлялись. |

## Что вручную настроить в Entra

1. Войдите в административный аккаунт с доступом к **своему каталогу**, в Settings → Directories + subscriptions выберите его. Для регистрации нужны соответствующие права, например Application Developer. Если каталога нет, используйте [официальную инструкцию создания/получения tenant](https://learn.microsoft.com/entra/identity-platform/quickstart-create-new-tenant). Создание Azure-аккаунта, принятие условий и возможные шаги с платёжными данными выполняет владелец самостоятельно.
2. Entra ID → App registrations → New registration: имя Play Your Life OneDrive. Для личных и рабочих аккаунтов выберите поддержку обоих типов и `MICROSOFT_TENANT=common`; для только личных — Personal Microsoft accounts и `consumers`.
3. Если приложение уже зарегистрировано: откройте именно его регистрацию, проверьте Supported account types и Manifest → signInAudience. Значения: `AzureADandPersonalMicrosoftAccount` для обоих типов либо `PersonalMicrosoftAccount` только для личных. Инструкция Microsoft: [изменение supported accounts](https://learn.microsoft.com/en-us/entra/identity-platform/howto-modify-supported-accounts). Если портал не позволяет переход для имеющейся регистрации, создайте новую совместимую регистрацию и перенесите её реальный Client ID/redirect/секрет в конфигурацию; не используйте ID из ошибки.
4. Скопируйте **Application (client) ID** в server variable MICROSOFT_CLIENT_ID. Не путайте его с Object ID или Directory (tenant) ID.
5. Authentication → Add a platform → **Web**. Redirect URI должен в точности равняться адресу вашего Worker и `/callback`, который покажет диагностика. Не подставляйте адрес страницы GitHub Pages, не выбирайте SPA для серверного flow. Если адрес Worker ещё не выбран, регистрацию можно создать без redirect URI и добавить его до запуска OAuth.
6. API permissions → Microsoft Graph → Delegated permissions: **User.Read**, **Files.ReadWrite**. При подключении MSAL также запрашивает стандартные OpenID/offline scopes. Application permissions не нужны. Существующей регистрации с прежним набором scopes может потребоваться новое пользовательское согласие.
7. Certificates & secrets → client secret: значение **Value** сохраняется в MICROSOFT_CLIENT_SECRET на сервере, не во фронтенде и не в чате. Настройте TOKEN_ENCRYPTION_KEY. Это делает владелец в защищённом Cloudflare/GitHub Secret Store.
8. Установите BRIDGE_URL, APP_URL, FIREBASE_PROJECT_ID и подходящий MICROSOFT_TENANT; frontend получает только VITE_ONEDRIVE_BRIDGE_URL. Список переменных и команды деплоя — [ONEDRIVE.md](ONEDRIVE.md).
9. После развёртывания войдите в Play Your Life → «Мой диск» → подключите личный Outlook через официальный Microsoft-вход. Проверка подключения сама выполняет только чтение. Данные авторизации в чат/логи передавать не нужно.

Учётная запись администратора регистрации может отличаться от личного аккаунта OneDrive. Конечные пользователи OneDrive не обязаны вступать гостями в каталог разработчика для consumer/common сценария. Каталог нужен владельцу регистрации для администрирования приложения.

## Доступная проверка и запуск

Локальный dev-server запускается командой:

```sh
npm ci
npm run dev -- --port 5173
```

Страница: `http://localhost:5173/#/drive`. Сначала требуется обычный вход Play Your Life. В облачном окружении адрес относится к этому окружению; на своём компьютере выполните те же команды. Фиктивные файлы для обычного dev/production не подставляются. Пока реальный Worker URL/Entra не настроены, страница честно сообщает об отсутствии подключения. Если появится доступный Vercel Preview этого PR, его точный адрес и результат проверки будут приведены в PR.

Автоматический UI harness отдельный, в `work/onedrive`, использует только явно тестовые метаданные/сервисные ответы. Он не служит доказательством настоящего OAuth Microsoft.

## Матрица проверки

| Проверка | Статус/граница |
| --- | --- |
| Причина и этап AADSTS50020 | Подтверждён пользователем вход в Entra; сверено с Microsoft Learn. |
| Real MSAL URL/PKCE/nonce/scopes | Пройдено с настоящей установленной библиотекой, offline authority metadata. |
| Callback/state/cookie/nonce/Graph failures | Пройдено с изолированными Microsoft-ответами и реальной криптографией/Firebase JWT verifier. |
| /me, /me/drive, root/children перед connected | HTTP 200 и порядок GET проверены на сервисных фикстурах; живые Microsoft endpoints не проверены. |
| Refresh/revocation и второй UID/устройство | Автоматические сценарии изоляции, сохранения/отказа и временной сети; реальные устройства/токены не использовались. |
| OneDrive UI и возврат формы | ПК и мобильные viewport 1440/768/390/320; интерфейс/ошибка/retry на Chromium с фикстурами. Это не physical Android OAuth. |
| npm run check / check:budgets | Пройдено. Основной JS 403,8 КБ gzip из 420; суммарные JS/CSS 1035,0 из 1040. |
| npm test | Пройдено: 657/657, без пропусков. |
| Профильные тесты OneDrive + quality gates | Пройдено: 17/17 после staging всех новых исходников. |
| Dev-server и обычный App | HTTP 200, версия 0.86.2; после штатного гостевого onboarding виден экран подключения, кнопка гостю недоступна. Файлы OneDrive не имитируются. |
| GitHub Actions | Финальный запуск для точного SHA будет указан в PR после push. |
| Личный Outlook/Hotmail/Live — настоящий вход | Не выполнено: нужна Entra-регистрация/сервер и безопасный интерактивный вход владельца. |
| Реальный Graph profile/drive/files, refresh после истечения | Не выполнено по той же причине. |
| Физический Android / WebView / системный браузер | Не выполнено. В репозитории веб/PWA; отдельного native WebView OAuth не добавлено. |
| OAuth на втором реальном устройстве / отзыв consent Microsoft | Не выполнено; требуется настроенное приложение. |

**Готовность:** кодовые ошибки исправлены и покрыты доступными автоматическими проверками; настройка собственного каталога/Entra, деплой и live-проверка ещё нужны. Ошибка административного входа Microsoft не объявляется устранённой изменением кода Play Your Life. Production и main не изменялись.
