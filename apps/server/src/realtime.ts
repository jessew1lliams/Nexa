import type { Server as HttpServer } from "node:http";

import { Server } from "socket.io";

import { getUserFromToken, getVisibleChatsForUser } from "./store.js";
import type { Message } from "./types.js";

let io: Server | null = null;

export function attachRealtime(server: HttpServer, clientOrigin: string) {
  io = new Server(server, {
    cors: {
      origin: clientOrigin,
      methods: ["GET", "POST"]
    }
  });

  io.use((socket, next) => {
    const token = typeof socket.handshake.auth.token === "string" ? socket.handshake.auth.token : null;
    const user = getUserFromToken(token);

    if (!user) {
      next(new Error("UNAUTHORIZED"));
      return;
    }

    socket.data.userId = user.id;
    next();
  });

  io.on("connection", (socket) => {
    const userId = String(socket.data.userId);
    const visibleChats = getVisibleChatsForUser(userId);

    for (const chat of visibleChats) {
      socket.join(chat.id);
    }

    socket.emit("presence:ready", {
      userId,
      joinedChatIds: visibleChats.map((chat) => chat.id)
    });
  });

  return io;
}

export function emitMessageCreated(chatId: string, message: Message) {
  io?.to(chatId).emit("message:created", {
    chatId,
    message
  });
}
