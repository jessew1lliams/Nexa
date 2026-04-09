import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";

import { appConfig } from "./config.js";
import { attachRealtime, emitMessageCreated } from "./realtime.js";
import {
  addMessage,
  buildChatSummary,
  createSession,
  getBootstrap,
  getChatById,
  getMessagesForChat,
  getUserFromToken,
  isChatMember,
  listDevUsers,
  upsertTelegramUser
} from "./store.js";
import { beginTelegramLogin, completeTelegramLogin } from "./telegram.js";

const sendMessageSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Сообщение не должно быть пустым.")
    .max(1500, "Сообщение слишком длинное. Максимум 1500 символов.")
});

function extractToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length);
}

function resolveCurrentUser(authorizationHeader: string | undefined) {
  const token = extractToken(authorizationHeader);
  return getUserFromToken(token);
}

async function startServer() {
  const app = Fastify({
    logger: true
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      reply.code(400).send({
        message: error.issues[0]?.message ?? "Некорректные данные запроса."
      });
      return;
    }

    const statusCode = typeof (error as { statusCode?: number }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 500;
    const message = error instanceof Error ? error.message : "Внутренняя ошибка сервера.";

    reply.code(statusCode).send({
      message
    });
  });

  await app.register(cors, {
    origin: appConfig.clientOrigin,
    credentials: true
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "Nexa API"
  }));

  app.get("/api/auth/providers", async () => ({
    dev: true,
    telegram: {
      enabled: appConfig.telegramEnabled
    }
  }));

  app.get("/api/auth/dev-users", async () => ({
    users: listDevUsers()
  }));

  app.post("/api/auth/dev-login", async (request, reply) => {
    const body = z.object({ userId: z.string().min(1) }).parse(request.body);
    const session = createSession(body.userId, "dev");

    if (!session) {
      reply.code(404).send({
        message: "Такого демо-пользователя не существует."
      });
      return;
    }

    return {
      token: session.token,
      provider: session.provider
    };
  });

  app.get("/api/auth/telegram/start", async (_request, reply) => {
    if (!appConfig.telegramEnabled) {
      reply.code(400).send({
        message: "Вход через Telegram пока не настроен."
      });
      return;
    }

    return beginTelegramLogin(appConfig);
  });

  app.get("/api/auth/telegram/callback", async (request, reply) => {
    const query = z
      .object({
        code: z.string().optional(),
        state: z.string().optional(),
        error: z.string().optional()
      })
      .parse(request.query);

    if (query.error) {
      reply.redirect(`${appConfig.clientOrigin}/auth/telegram/callback?error=${encodeURIComponent(query.error)}`);
      return;
    }

    if (!query.code || !query.state) {
      reply.redirect(`${appConfig.clientOrigin}/auth/telegram/callback?error=missing_code`);
      return;
    }

    try {
      const telegramProfile = await completeTelegramLogin(appConfig, query.code, query.state);
      const user = upsertTelegramUser(telegramProfile);
      if (!user) {
        throw new Error("Не удалось связать Telegram-аккаунт с Nexa.");
      }

      const session = createSession(user.id, "telegram");
      if (!session) {
        throw new Error("Не удалось создать сессию Nexa.");
      }

      reply.redirect(`${appConfig.clientOrigin}/auth/telegram/callback?token=${encodeURIComponent(session.token)}`);
    } catch (error) {
      request.log.error(error);
      reply.redirect(`${appConfig.clientOrigin}/auth/telegram/callback?error=telegram_login_failed`);
    }
  });

  app.get("/api/bootstrap", async (request, reply) => {
    const user = resolveCurrentUser(request.headers.authorization);
    if (!user) {
      reply.code(401).send({
        message: "Нужно войти в Nexa."
      });
      return;
    }

    return getBootstrap(user.id, {
      serverName: appConfig.serverName,
      universityName: appConfig.universityName,
      telegramEnabled: appConfig.telegramEnabled
    });
  });

  app.get("/api/chats/:chatId/messages", async (request, reply) => {
    const user = resolveCurrentUser(request.headers.authorization);
    if (!user) {
      reply.code(401).send({
        message: "Нужно войти в Nexa."
      });
      return;
    }

    const params = z.object({ chatId: z.string().min(1) }).parse(request.params);
    if (!isChatMember(params.chatId, user.id)) {
      reply.code(403).send({
        message: "У вас нет доступа к этому чату."
      });
      return;
    }

    return {
      chatId: params.chatId,
      messages: getMessagesForChat(params.chatId)
    };
  });

  app.post("/api/chats/:chatId/messages", async (request, reply) => {
    const user = resolveCurrentUser(request.headers.authorization);
    if (!user) {
      reply.code(401).send({
        message: "Нужно войти в Nexa."
      });
      return;
    }

    const params = z.object({ chatId: z.string().min(1) }).parse(request.params);
    const body = sendMessageSchema.parse(request.body);

    const chat = getChatById(params.chatId);
    if (!chat || !chat.memberIds.includes(user.id)) {
      reply.code(403).send({
        message: "Вы не состоите в этом чате."
      });
      return;
    }

    const message = addMessage(chat.id, user.id, body.text);
    if (!message) {
      reply.code(400).send({
        message: "Сообщение не удалось отправить."
      });
      return;
    }

    const chatSummary = buildChatSummary(chat.id, user.id);
    emitMessageCreated(chat.id, message);

    return {
      message,
      chat: chatSummary
    };
  });

  attachRealtime(app.server, appConfig.clientOrigin);

  await app.listen({
    port: appConfig.port,
    host: "0.0.0.0"
  });
}

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
