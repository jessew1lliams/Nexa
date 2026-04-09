export type ChatKind = "group" | "direct" | "channel";
export type UserRole = "student" | "curator" | "teacher";

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

export interface ChatSummary {
  id: string;
  title: string;
  kind: ChatKind;
  memberIds: string[];
  accentColor: string;
  description: string;
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

export interface AuthProvidersResponse {
  dev: boolean;
  telegram: {
    enabled: boolean;
  };
}
