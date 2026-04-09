export type ChatKind = "group" | "direct" | "channel";
export type UserRole = "student" | "curator" | "teacher";
export type AuthProvider = "dev" | "telegram";

export interface User {
  id: string;
  telegramId: number;
  name: string;
  username: string;
  role: UserRole;
  accentColor: string;
  bio: string;
  photoUrl?: string;
  phoneNumber?: string;
}

export interface Chat {
  id: string;
  title: string;
  kind: ChatKind;
  memberIds: string[];
  accentColor: string;
  description: string;
}

export interface ChatSummary extends Chat {
  lastMessagePreview: string;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface Message {
  id: string;
  chatId: string;
  authorId: string;
  text: string;
  sentAt: string;
}

export interface Session {
  token: string;
  userId: string;
  provider: AuthProvider;
  createdAt: string;
}

export interface BootstrapPayload {
  meta: {
    serverName: string;
    universityName: string;
    accessModel: string;
    telegramEnabled: boolean;
  };
  currentUser: User;
  users: User[];
  chats: ChatSummary[];
  messagesByChat: Record<string, Message[]>;
}

export interface TelegramProfile {
  telegramId: number;
  name: string;
  username?: string;
  picture?: string;
  phoneNumber?: string;
}
