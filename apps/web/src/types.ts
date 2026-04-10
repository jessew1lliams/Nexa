export type ChatKind = "group" | "direct" | "channel";
export type UserRole = "student" | "curator" | "teacher";
export type RuntimeMode = "demo" | "supabase";

export interface AppUser {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  accentColor: string;
  bio: string;
  email?: string;
  avatarUrl?: string;
}

export interface ChatRecord {
  id: string;
  title: string;
  kind: ChatKind;
  description: string;
  accentColor: string;
  isDefault?: boolean;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  authorId: string;
  text: string;
  sentAt: string;
}

export interface ChatSummary extends ChatRecord {
  memberIds: string[];
  lastMessagePreview: string;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface WorkspaceData {
  currentUser: AppUser;
  users: AppUser[];
  chatRecords: ChatRecord[];
  memberIdsByChat: Record<string, string[]>;
  chats: ChatSummary[];
  messagesByChat: Record<string, ChatMessage[]>;
  mode: RuntimeMode;
  syncLabel: string;
  universityName: string;
}

export interface SupabaseProfileRow {
  id: string;
  email: string | null;
  full_name: string;
  username: string;
  role: UserRole | null;
  accent_color: string;
  bio: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

export interface SupabaseChatRow {
  id: string;
  title: string;
  kind: ChatKind;
  description: string;
  accent_color: string;
  is_default: boolean | null;
  created_at?: string;
}

export interface SupabaseChatMemberRow {
  chat_id: string;
  user_id: string;
  joined_at?: string;
}

export interface SupabaseMessageRow {
  id: string;
  chat_id: string;
  author_id: string;
  content: string;
  created_at: string;
}
