import { randomBytes, randomUUID } from "node:crypto";

import { db } from "./database.js";
import type {
  BootstrapPayload,
  Chat,
  ChatSummary,
  Message,
  Session,
  TelegramProfile,
  User
} from "./types.js";

const accentPool = ["#2795FF", "#F77F5A", "#47B39C", "#6D83F2", "#F2C14E", "#7E6BFF"];

type UserRow = {
  id: string;
  telegram_id: number;
  name: string;
  username: string;
  role: User["role"];
  accent_color: string;
  bio: string;
  photo_url: string | null;
  phone_number: string | null;
};

type ChatRow = {
  id: string;
  title: string;
  kind: Chat["kind"];
  accent_color: string;
  description: string;
};

type MessageRow = {
  id: string;
  chat_id: string;
  author_id: string;
  text: string;
  sent_at: string;
};

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    telegramId: Number(row.telegram_id),
    name: row.name,
    username: row.username,
    role: row.role,
    accentColor: row.accent_color,
    bio: row.bio,
    photoUrl: row.photo_url ?? undefined,
    phoneNumber: row.phone_number ?? undefined
  };
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    chatId: row.chat_id,
    authorId: row.author_id,
    text: row.text,
    sentAt: row.sent_at
  };
}

function getChatMembers(chatId: string) {
  const rows = db
    .prepare("SELECT user_id FROM chat_members WHERE chat_id = ? ORDER BY user_id")
    .all(chatId) as Array<{ user_id: string }>;

  return rows.map((row) => row.user_id);
}

function mapChat(row: ChatRow): Chat {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    memberIds: getChatMembers(row.id),
    accentColor: row.accent_color,
    description: row.description
  };
}

function buildPreview(message: Message, viewerId: string) {
  if (message.authorId === viewerId) {
    return `Вы: ${message.text}`;
  }

  const author = getUserById(message.authorId);
  const authorName = author?.name.split(" ")[0] ?? "Кто-то";
  return `${authorName}: ${message.text}`;
}

function resolveDirectTitle(chat: Chat, viewerId: string) {
  if (chat.kind !== "direct") {
    return chat.title;
  }

  const peerId = chat.memberIds.find((memberId) => memberId !== viewerId);
  const peer = peerId ? getUserById(peerId) : null;
  return peer?.name ?? chat.title;
}

function resolveDirectDescription(chat: Chat, viewerId: string) {
  if (chat.kind !== "direct") {
    return chat.description;
  }

  const peerId = chat.memberIds.find((memberId) => memberId !== viewerId);
  const peer = peerId ? getUserById(peerId) : null;
  return peer?.username ? `@${peer.username}` : chat.description;
}

function sortByLatest(chatsToSort: ChatSummary[]) {
  return [...chatsToSort].sort((left, right) => {
    const leftTime = left.lastMessageAt ? new Date(left.lastMessageAt).getTime() : 0;
    const rightTime = right.lastMessageAt ? new Date(right.lastMessageAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

export function listDevUsers() {
  const rows = db.prepare("SELECT * FROM users ORDER BY id").all() as UserRow[];
  return rows.map(mapUser);
}

export function getUserById(userId: string) {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function getUserFromToken(token: string | null | undefined) {
  if (!token) {
    return null;
  }

  const row = db
    .prepare(`
      SELECT u.*
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
    `)
    .get(token) as UserRow | undefined;

  return row ? mapUser(row) : null;
}

export function createSession(userId: string, provider: Session["provider"]) {
  if (!getUserById(userId)) {
    return null;
  }

  const session: Session = {
    token: randomBytes(24).toString("base64url"),
    userId,
    provider,
    createdAt: new Date().toISOString()
  };

  db.prepare(
    "INSERT INTO sessions (token, user_id, provider, created_at) VALUES (?, ?, ?, ?)"
  ).run(session.token, session.userId, session.provider, session.createdAt);

  return session;
}

export function getVisibleChatsForUser(userId: string) {
  const rows = db
    .prepare(`
      SELECT c.*
      FROM chats c
      JOIN chat_members cm ON cm.chat_id = c.id
      WHERE cm.user_id = ?
      ORDER BY c.id
    `)
    .all(userId) as ChatRow[];

  return rows.map(mapChat);
}

export function getChatById(chatId: string) {
  const row = db.prepare("SELECT * FROM chats WHERE id = ?").get(chatId) as ChatRow | undefined;
  return row ? mapChat(row) : null;
}

export function isChatMember(chatId: string, userId: string) {
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM chat_members WHERE chat_id = ? AND user_id = ?")
    .get(chatId, userId) as { count: number };

  return row.count > 0;
}

export function getMessagesForChat(chatId: string) {
  const rows = db
    .prepare("SELECT * FROM messages WHERE chat_id = ? ORDER BY sent_at ASC, id ASC")
    .all(chatId) as MessageRow[];

  return rows.map(mapMessage);
}

export function buildChatSummary(chatId: string, viewerId: string) {
  const chat = getChatById(chatId);
  if (!chat) {
    return null;
  }

  const chatMessages = getMessagesForChat(chat.id);
  const lastMessage = chatMessages.at(-1);

  const summary: ChatSummary = {
    ...chat,
    title: resolveDirectTitle(chat, viewerId),
    description: resolveDirectDescription(chat, viewerId),
    lastMessagePreview: lastMessage ? buildPreview(lastMessage, viewerId) : "Пока без сообщений",
    lastMessageAt: lastMessage?.sentAt ?? null,
    unreadCount: 0
  };

  return summary;
}

export function getBootstrap(
  userId: string,
  meta: Pick<BootstrapPayload["meta"], "serverName" | "telegramEnabled" | "universityName">
) {
  const currentUser = getUserById(userId);
  if (!currentUser) {
    return null;
  }

  const visibleChats = getVisibleChatsForUser(userId);
  const visibleChatSummaries = sortByLatest(
    visibleChats
      .map((chat) => buildChatSummary(chat.id, userId))
      .filter((chat): chat is ChatSummary => Boolean(chat))
  );

  const visibleUsers = (db
    .prepare(`
      SELECT DISTINCT u.*
      FROM users u
      JOIN chat_members cm ON cm.user_id = u.id
      WHERE cm.chat_id IN (
        SELECT chat_id
        FROM chat_members
        WHERE user_id = ?
      )
      ORDER BY u.id
    `)
    .all(userId) as UserRow[]).map(mapUser);

  const visibleMessages = Object.fromEntries(
    visibleChats.map((chat) => [chat.id, getMessagesForChat(chat.id)])
  );

  const payload: BootstrapPayload = {
    meta: {
      ...meta,
      accessModel: "Private university network"
    },
    currentUser,
    users: visibleUsers,
    chats: visibleChatSummaries,
    messagesByChat: visibleMessages
  };

  return payload;
}

export function addMessage(chatId: string, authorId: string, text: string) {
  if (!isChatMember(chatId, authorId)) {
    return null;
  }

  const message: Message = {
    id: randomUUID(),
    chatId,
    authorId,
    text,
    sentAt: new Date().toISOString()
  };

  db.prepare(
    "INSERT INTO messages (id, chat_id, author_id, text, sent_at) VALUES (?, ?, ?, ?, ?)"
  ).run(message.id, message.chatId, message.authorId, message.text, message.sentAt);

  return message;
}

export function upsertTelegramUser(profile: TelegramProfile) {
  const existingRow = db
    .prepare("SELECT * FROM users WHERE telegram_id = ?")
    .get(profile.telegramId) as UserRow | undefined;

  if (existingRow) {
    const updatedUser = {
      ...mapUser(existingRow),
      name: profile.name || existingRow.name,
      username: profile.username || existingRow.username,
      photoUrl: profile.picture ?? existingRow.photo_url ?? undefined,
      phoneNumber: profile.phoneNumber ?? existingRow.phone_number ?? undefined
    };

    db.prepare(`
      UPDATE users
      SET name = ?, username = ?, photo_url = ?, phone_number = ?
      WHERE id = ?
    `).run(
      updatedUser.name,
      updatedUser.username,
      updatedUser.photoUrl ?? null,
      updatedUser.phoneNumber ?? null,
      updatedUser.id
    );

    return updatedUser;
  }

  const userId = `u-${randomUUID()}`;
  const accentColor = accentPool[Math.floor(Math.random() * accentPool.length)];

  const newUser: User = {
    id: userId,
    telegramId: profile.telegramId,
    name: profile.name,
    username: profile.username || `telegram${String(profile.telegramId).slice(-5)}`,
    role: "student",
    accentColor,
    bio: "Новый участник Nexa, вошедший через Telegram.",
    photoUrl: profile.picture,
    phoneNumber: profile.phoneNumber
  };

  db.prepare(`
    INSERT INTO users (id, telegram_id, name, username, role, accent_color, bio, photo_url, phone_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newUser.id,
    newUser.telegramId,
    newUser.name,
    newUser.username,
    newUser.role,
    newUser.accentColor,
    newUser.bio,
    newUser.photoUrl ?? null,
    newUser.phoneNumber ?? null
  );

  return newUser;
}
