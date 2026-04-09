# Nexa

`Nexa` теперь подготовлен под схему как у `ChanceMusic`:

- сам сайт открывается через `GitHub Pages`
- общие данные и сообщения можно хранить в `Supabase`
- после каждого `push` в `main` сайт может обновляться автоматически

## Что теперь в проекте

- `apps/web` — статический клиент для GitHub Pages
- `.github/workflows/deploy-pages.yml` — автодеплой сайта
- `supabase/nexa_schema.sql` — SQL-схема для общей базы
- `apps/web/src/supabase.ts` — подключение к Supabase

## Локальный запуск сайта

```bash
npm install
copy apps\web\.env.example apps\web\.env
npm run dev:web
```

Открыть:

```text
http://localhost:5173
```

## GitHub Pages

В репозитории уже добавлен workflow для Pages.

Чтобы сайт реально открылся через GitHub:

1. Открой репозиторий `jessew1lliams/Nexa`.
2. Перейди в `Settings` -> `Pages`.
3. В `Source` выбери `GitHub Actions`.
4. После этого каждый новый `push` в `main` будет запускать деплой.

Публичный адрес будет такого вида:

```text
https://jessew1lliams.github.io/Nexa/
```

Если репозиторий остаётся `Private`, обрати внимание на важный нюанс:

- GitHub Pages для `private`-репозиториев доступен не на всех планах GitHub
- если Pages не публикуется, проще всего сделать репозиторий `public` или использовать платный план GitHub
- источник: GitHub Docs  
  https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## GitHub Secrets для Supabase

Чтобы сайт на GitHub Pages работал с общей базой, добавь в репозиторий:

`Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

Нужны два секрета:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Если они не добавлены, сайт всё равно откроется, но будет работать только в демо-режиме на одном устройстве.

## Supabase

1. Создай проект в Supabase.
2. Открой `SQL Editor`.
3. Вставь содержимое файла `supabase/nexa_schema.sql`.
4. Выполни SQL.

Это создаст:

- `profiles`
- `chats`
- `chat_members`
- `messages`
- default-чат `Nexa / Общий чат`
- базовые `RLS` policies

После этого пользователи, вошедшие через сайт, смогут видеть общий чат и общие сообщения.

## Как это работает сейчас

- без Supabase: сайт открывается через GitHub Pages и работает как демо
- с Supabase: сайт остаётся на GitHub Pages, а переписка становится общей и постоянной

## Важно

`GitHub Pages` хранит и открывает сайт, но не запускает backend.

Поэтому для схемы “как ChanceMusic” правильный путь именно такой:

- интерфейс и публикация: `GitHub Pages`
- данные и синхронизация: `Supabase`
