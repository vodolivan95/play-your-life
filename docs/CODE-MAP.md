# Карта кода PLAY YOUR LIFE

Codex читает правила корневого AGENTS.md автоматически. Эта карта сокращает начальный поиск; она не заменяет проверку исходников.

## От раздела сайта к файлам

Все компоненты ниже находятся в `src/components/`, логика — в `src/`, тесты — в `tests/`. CSS обычно лежит рядом с одноимённым компонентом.

| Раздел / задача | Компоненты | Логика | Проверки |
| --- | --- | --- | --- |
| Главная, следующая вершина | HomeDashboard.tsx, HomeBanner.tsx, HomeYearSummary.tsx | nextPeak.ts, monthlyFocus.ts, yearReport.ts | home-ui.mjs, next-peak.test.ts |
| Проекты, этапы, материалы | GoalsBoard.tsx, GoalWorkspace.tsx, StageScreen.tsx, GoalTaskList.tsx | goalWorkspace.ts, goalRoutes.ts, projectMaterials.ts, localMaterialFiles.ts | goal-workspace.test.ts, project-materials.test.ts, goals-ui.mjs |
| Задачи, создание и окно задачи | TodayTasks.tsx, TaskWindow.tsx, TaskCreationForm.tsx | taskEditor.ts, taskDetails.ts, taskSettings.ts, taskRoutes.ts | unified-task-editor.test.ts, task-details.test.ts, task-window-ui.mjs |
| Перенос задач | TaskReorderList.tsx, useFlipAnimation.ts | goalWorkspace.ts | goals-ui.mjs |
| Календарь | TasksCalendar.tsx, TaskCalendar.tsx | tasksCalendar.ts | tasks-calendar.test.ts, tasks-calendar-ui.mjs |
| Мой план, неделя, обзор | PlanningWorkspace.tsx, WeekPlanBoard.tsx, WeeklyReviewWizard.tsx | planning.ts, weekPlan.ts, weeklyReview.ts | week-plan.test.ts, weekly-review.test.ts, weekly-review-ui.mjs |
| Фокус и таймер | FocusSection.tsx, FocusBar.tsx, FocusStats.tsx | focusCore.ts, focusSessions.ts, taskTimer.ts | focus-sessions.test.ts, task-timer.test.ts, focus-ui.mjs |
| TickTick, входящие, привычки | TickTickConnection.tsx, TickTickInbox.tsx, TickTickHabits.tsx | ticktick.ts, useTickTick.ts, ticktickInbox.ts, ticktickHabitsSync.ts | ticktick.test.ts, ticktick-worker.test.ts, ticktick-flow-ui.mjs |
| База знаний и заметки сфер | KnowledgeBase.tsx, SphereNotes.tsx, RichEditor.tsx, useStoredDoc.ts | knowledgeBase.ts, sphereNotes.ts, richText.ts | knowledge-base.test.ts, smoke-ui.mjs |
| Сферы, навыки, награды | SpheresOverview.tsx, SphereHub.tsx, SkillTree.tsx | sphereProgress.ts, skillTree.ts, questEconomy.ts, game.ts | game.test.ts, skill-tree.test.ts, spheres-ui.mjs |
| Город и погода | CoastalCity.tsx, LiveCityCanvas.tsx, city3d/ | cityLive/, coastalCity.ts, weatherSystem.ts | live-city.test.ts, weatherSystem.test.ts, live-city-ui.mjs |
| Комнаты и магазин | room3d/, shop3d/ | roomEngine.ts, roomViews.ts, shop.ts, shopModels.ts | room-engine.test.ts, room-views.test.ts, shop.test.ts |
| Вход и сохранения | ../AccountRoot.tsx | firebaseClient.ts, firebaseSave.ts, accountPersistence.ts, stateValidation.ts, stateMerge.ts | state-roundtrip.test.ts, state-merge.test.ts, firebase-rules.test.mjs |
| Орфография | ../spellcheck.css | spellcheck.ts, spellcheck.worker.ts, spellcheckText.ts | spellcheck.test.ts, spellcheck-ui.mjs |
| Тема, общее оформление | ThemeSwitch.tsx | styles.css, interface.css, theme-dark.css, theme-light-glass.css | theme-ui.mjs |

Оболочка и связи экранов: `src/App.tsx`, `src/navigation.ts`; точка входа: `src/main.tsx`. Сервер TickTick: `integrations/ticktick/worker.ts`. Правила базы: `firestore.rules`. CI: `.github/workflows/ci.yml`. Профильные требования ищи по имени раздела в `docs/`, не читай все документы подряд.

## Точечный поиск

```sh
rg --files src/components | rg 'Task|Goal|Stage'
rg -n 'имяФункции|текст кнопки' src/components/TaskWindow.tsx src/task*.ts
# Прочитать найденный участок, например:
sed -n '120,200p' src/components/TaskWindow.tsx
```

## Локальный граф Graphify

Индекс строится по AST локально: без API-ключей и отправки исходников в LLM. Он не нужен для запуска сайта. Версия инструмента зафиксирована для воспроизводимости; npm-зависимости приложения не меняются.

```sh
uv tool install graphifyy==0.9.111
# Если uv сообщил, что каталог команд отсутствует в PATH:
export PATH="$(uv tool dir --bin):$PATH"
# Из корня репозитория:
graphify extract . --code-only --no-cluster
graphify query "TaskWindow" --budget 1200 --depth 1
graphify query "goalWorkspace" --budget 1200 --depth 1
graphify affected "TaskWindow" --depth 1
```

Если домашняя папка недоступна для записи (как в текущем облачном окружении), установка и команды:

```sh
export UV_CACHE_DIR=/workspace/.cache/uv
export UV_TOOL_DIR=/workspace/.local/share/uv/tools
export UV_TOOL_BIN_DIR=/workspace/.local/bin
export PATH="$UV_TOOL_BIN_DIR:$PATH"
uv tool install graphifyy==0.9.111
```

После checkout/pull или изменения исходников повтори `graphify extract . --code-only --no-cluster`. Индекс в `graphify-out/` локальный, не отслеживается Git. Не читай весь graph.json: используй query/explain/affected. Если Graphify недоступен или символ не найден, переходи к `rg`, не блокируй задачу. Русские названия разделов сопоставляй с именами файлов по таблице выше.
