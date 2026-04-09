import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import type { Chat, Message, User } from "./types.js";

const minutesAgo = (value: number) => new Date(Date.now() - value * 60_000).toISOString();

const seedUsers: User[] = [
  {
    id: "u1",
    telegramId: 700100001,
    name: "Ксюша Никифорова",
    username: "ksushan",
    role: "student",
    accentColor: "#2795FF",
    bio: "Староста группы и человек, который хочет сделать Nexa уютным."
  },
  {
    id: "u2",
    telegramId: 700100002,
    name: "Илья Соколов",
    username: "ilya_net",
    role: "student",
    accentColor: "#F77F5A",
    bio: "Любит собирать всё по дедлайнам и отвечать в два ночи."
  },
  {
    id: "u3",
    telegramId: 700100003,
    name: "Марина Волкова",
    username: "marina_v",
    role: "student",
    accentColor: "#47B39C",
    bio: "Следит, чтобы полезные сообщения не тонули в общем чате."
  },
  {
    id: "u4",
    telegramId: 700100004,
    name: "Анна Сергеева",
    username: "curator_anna",
    role: "curator",
    accentColor: "#6D83F2",
    bio: "Куратор курса. Объявления, оргвопросы и важные напоминания."
  }
];

const seedChats: Chat[] = [
  {
    id: "chat-general",
    title: "Наша группа / Общий",
    kind: "group",
    memberIds: ["u1", "u2", "u3", "u4"],
    accentColor: "#2795FF",
    description: "Повседневный чат группы: новости, переносы и обычная болталка."
  },
  {
    id: "chat-labs",
    title: "Лабы по сетям",
    kind: "group",
    memberIds: ["u1", "u2", "u3"],
    accentColor: "#F77F5A",
    description: "Вопросы по лабораторным, отчётам и защите."
  },
  {
    id: "chat-curator",
    title: "Куратор / Объявления",
    kind: "channel",
    memberIds: ["u1", "u2", "u3", "u4"],
    accentColor: "#47B39C",
    description: "Организационные сообщения, которые лучше не пропускать."
  },
  {
    id: "chat-direct-u2",
    title: "Личный диалог",
    kind: "direct",
    memberIds: ["u1", "u2"],
    accentColor: "#6D83F2",
    description: "Приватный диалог."
  }
];

const seedMessages: Message[] = [
  {
    id: "m1",
    chatId: "chat-general",
    authorId: "u4",
    text: "Ребята, пары в пятницу переносят на 10:00.",
    sentAt: minutesAgo(120)
  },
  {
    id: "m2",
    chatId: "chat-general",
    authorId: "u1",
    text: "Супер, тогда успеем собраться пораньше. Я потом закину аудиторию.",
    sentAt: minutesAgo(114)
  },
  {
    id: "m3",
    chatId: "chat-general",
    authorId: "u2",
    text: "Если кто-то пропустил конспект по БД, могу отправить сюда PDF.",
    sentAt: minutesAgo(78)
  },
  {
    id: "m4",
    chatId: "chat-labs",
    authorId: "u3",
    text: "У кого уже засчитали третью лабу? Хочу понять, что спрашивают на защите.",
    sentAt: minutesAgo(55)
  },
  {
    id: "m5",
    chatId: "chat-labs",
    authorId: "u2",
    text: "У меня приняли. Больше всего спрашивали по маршрутизации и схемам.",
    sentAt: minutesAgo(49)
  },
  {
    id: "m6",
    chatId: "chat-curator",
    authorId: "u4",
    text: "До понедельника пришлите тему курсовой старосте, пожалуйста.",
    sentAt: minutesAgo(40)
  },
  {
    id: "m7",
    chatId: "chat-direct-u2",
    authorId: "u2",
    text: "Ты будешь сегодня в универе после четвёртой пары?",
    sentAt: minutesAgo(24)
  },
  {
    id: "m8",
    chatId: "chat-direct-u2",
    authorId: "u1",
    text: "Да, минут 20 ещё точно буду. Могу флешку захватить.",
    sentAt: minutesAgo(19)
  }
];

const databaseFilePath = fileURLToPath(new URL("../data/nexa.db", import.meta.url));
mkdirSync(dirname(databaseFilePath), { recursive: true });

export const db = new DatabaseSync(databaseFilePath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    telegram_id INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    role TEXT NOT NULL,
    accent_color TEXT NOT NULL,
    bio TEXT NOT NULL,
    photo_url TEXT,
    phone_number TEXT
  );

  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    accent_color TEXT NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_members (
    chat_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (chat_id, user_id),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    text TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

function seedDatabaseIfEmpty() {
  const row = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  if (row.count > 0) {
    return;
  }

  const insertUser = db.prepare(`
    INSERT INTO users (id, telegram_id, name, username, role, accent_color, bio, photo_url, phone_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertChat = db.prepare(`
    INSERT INTO chats (id, title, kind, accent_color, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertChatMember = db.prepare(`
    INSERT INTO chat_members (chat_id, user_id)
    VALUES (?, ?)
  `);
  const insertMessage = db.prepare(`
    INSERT INTO messages (id, chat_id, author_id, text, sent_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN");
  try {
    for (const user of seedUsers) {
      insertUser.run(
        user.id,
        user.telegramId,
        user.name,
        user.username,
        user.role,
        user.accentColor,
        user.bio,
        user.photoUrl ?? null,
        user.phoneNumber ?? null
      );
    }

    for (const chat of seedChats) {
      insertChat.run(chat.id, chat.title, chat.kind, chat.accentColor, chat.description);
      for (const memberId of chat.memberIds) {
        insertChatMember.run(chat.id, memberId);
      }
    }

    for (const message of seedMessages) {
      insertMessage.run(message.id, message.chatId, message.authorId, message.text, message.sentAt);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

seedDatabaseIfEmpty();
