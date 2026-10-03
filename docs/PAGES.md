# Публикация через GitHub Pages

Адрес сайта после успешной публикации: https://vodolivan95.github.io/play-your-life/

## Один раз в GitHub

1. Сохраните изменения проекта в ветку `main` через Commit и Sync/Push в Codespaces. Если изменения в другой ветке, создайте Pull Request и нажмите Merge pull request.
2. Откройте репозиторий → Settings → Pages.
3. В разделе Build and deployment выберите Source → GitHub Actions.
4. Откройте Actions → Deploy to GitHub Pages → Run workflow → main → Run workflow.
5. Дождитесь зелёной галочки. Откройте адрес сайта выше.

После каждого изменения в `main` сайт обновляется автоматически. Если Actions ещё не разрешены для репозитория, включите их во вкладке Actions. Для приватных репозиториев доступность Pages зависит от тарифа GitHub.

## Как устроено

Существующая проверка `ci.yml` сохранена. Отдельный `pages.yml` устанавливает зависимости через npm ci, запускает тесты игровой логики и npm run check, загружает dist и публикует артефакт официальными GitHub Actions. Доступ записи ограничен задачей публикации, используется временная OIDC-авторизация GitHub, дополнительные секреты не нужны.

При публикации VITE_BASE_PATH=/play-your-life/ задаёт корректные ссылки на ресурсы. При обычном npm run dev приложение работает от корня. Для локальной проверки опубликованной сборки:

```sh
VITE_BASE_PATH=/play-your-life/ npm run check
VITE_BASE_PATH=/play-your-life/ npm run preview
```

Откройте http://localhost:4173/play-your-life/. Экраны переключаются внутри приложения, дополнительные настройки SPA-маршрутов не нужны. Прогресс остаётся локальным для устройства и адреса сайта: данные localhost не переносятся автоматически на GitHub Pages.
