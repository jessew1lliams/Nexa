# Nexa

`Nexa` is a private university messenger with a Telegram-inspired interface, a real backend, live updates over WebSocket, and persistent message storage.

## Что уже есть

- свой backend на `Fastify`
- чат-интерфейс на `React + Vite`
- realtime через `Socket.IO`
- постоянное хранение сообщений в `SQLite`
- заготовка входа через `Telegram`
- один production-сервис: сайт и API работают вместе

## Структура проекта

```text
D:\Nexa
├─ apps
│  ├─ server
│  └─ web
├─ Dockerfile
├─ railway.toml
└─ package.json
```

## Локальный запуск

1. Установить зависимости:

```bash
npm install
```

2. Скопировать env-файлы:

```bash
copy apps\server\.env.example apps\server\.env
copy apps\web\.env.example apps\web\.env
```

3. Запустить backend:

```bash
npm run dev:server
```

4. Во втором терминале запустить frontend:

```bash
npm run dev:web
```

5. Открыть:

```text
http://localhost:5173
```

## Продакшен

Сайт и backend можно запустить как один сервис:

```bash
npm run build
npm run start
```

После сборки сервер сам раздаёт фронтенд из `apps/web/dist`.

## Постоянная работа 24/7

Если люди должны писать друг другу в любое время, `Nexa` должен работать на отдельном сервере, а не на твоём ПК.

Важно: `GitHub` сам по себе хранит код, но не запускает мессенджер постоянно. Для этого нужен хостинг.

## Railway деплой

Для `Nexa` я подготовил деплой под `Railway`:

- автодеплой из GitHub при новых пушах
- публичный домен вида `*.railway.app`
- volume для постоянного хранения `SQLite`
- healthcheck по `/health`
- запуск через `Dockerfile`

Почему Railway здесь подходит:

- Railway поддерживает `GitHub Autodeploys`: [официальная документация](https://docs.railway.com/build-deploy)
- Railway даёт публичные домены `*.railway.app`: [официальная документация](https://docs.railway.com/guides/manage-domains)
- Railway поддерживает `Volumes` для постоянных данных: [официальная документация](https://docs.railway.com/overview/the-basics)

### Что сделать в Railway

1. Зайди в Railway и создай новый проект из GitHub-репозитория `jessew1lliams/Nexa`.
2. Railway сам увидит `Dockerfile` и `railway.toml`.
3. После первого деплоя создай `Volume` и примонтируй его в:

```text
/app/apps/server/data
```

4. Добавь переменные окружения:

```text
NODE_ENV=production
SERVER_NAME=Nexa
UNIVERSITY_NAME=Your University
SESSION_SECRET=change-me-in-production
```

5. Нажми `Generate Domain`, чтобы получить публичный адрес сайта.
6. После этого каждый новый `git push` в `main` будет автоматически выкатывать обновления.

## Telegram вход

Для реального входа через Telegram потом понадобятся значения:

- `TELEGRAM_CLIENT_ID`
- `TELEGRAM_CLIENT_SECRET`
- `TELEGRAM_REDIRECT_URI`

Когда у сайта появится настоящий публичный URL, `TELEGRAM_REDIRECT_URI` нужно будет поменять на адрес твоего домена.
