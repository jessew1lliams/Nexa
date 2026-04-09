# Nexa

`Nexa` is a private campus messenger prototype for desktop, Android and iOS.
This first milestone focuses on a strong MVP foundation:

- a real backend server
- a Telegram-inspired chat UI
- live messaging over WebSocket
- a development login flow
- a ready backend path for real Telegram sign-in via OIDC

## Stack

- `apps/server`: Fastify + Socket.IO + Telegram OIDC skeleton
- `apps/web`: React + Vite + responsive chat UI
- shared approach: one backend and one frontend foundation that we can later extend into mobile and desktop builds

## Project Structure

```text
D:\Nexa
├─ apps
│  ├─ server
│  └─ web
├─ package.json
└─ README.md
```

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Copy environment examples:

```bash
copy apps\server\.env.example apps\server\.env
copy apps\web\.env.example apps\web\.env
```

3. Start the backend:

```bash
npm run dev:server
```

4. Start the frontend in a second terminal:

```bash
npm run dev:web
```

5. Open:

```text
http://localhost:5173
```

## Telegram Login Setup

Development works without Telegram. For the real university rollout, add these values in `apps/server/.env`:

- `TELEGRAM_CLIENT_ID`
- `TELEGRAM_CLIENT_SECRET`
- `TELEGRAM_REDIRECT_URI`

The redirect URI must match the URL registered in BotFather Web Login settings.

## What Works Right Now

- login as seeded campus users for development
- view chats and messages
- send messages
- receive live message updates through Socket.IO
- prepare the backend for real Telegram sign-in

## Suggested Next Steps

1. Add persistent database storage instead of in-memory seed data.
2. Add university invite codes and role-based access.
3. Add channels, file attachments and notifications.
4. Create a mobile shell for Android/iOS after the server model settles.

## Always-On Mode

If people should keep chatting when your computer is off, Nexa must run on a separate server that stays online 24/7.

This prototype now stores its data in a local SQLite database file at pps/server/data/nexa.db, so messages survive server restarts.

For a real university rollout, the next production step is:

1. move the backend to a VPS or university server
2. put the server behind HTTPS and a domain
3. keep a database backup strategy
4. add invite-only access and notifications

