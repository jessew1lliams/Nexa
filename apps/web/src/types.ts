export type ChatKind = "group" | "direct" | "channel";
export type UserRole = "member" | "moderator" | "owner";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type NicknameGlow = "none" | "soft" | "strong";
export type RuntimeMode = "demo" | "supabase";

export interface AppUser {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  approvalStatus: ApprovalStatus;
  accentColor: string;
  nicknameGlow: NicknameGlow;
  allowGifs: boolean;
  bio: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  birthDate?: string;
  mutedUntil?: string;
  bannedAt?: string;
  bannedBy?: string;
  banReason?: string;
  cryptoPublicKey?: string;
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
  role: string | null;
  approval_status?: string | null;
  accent_color: string;
  nickname_glow?: string | null;
  allow_gifs?: boolean | null;
  bio: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  birth_date?: string | null;
  muted_until?: string | null;
  banned_at?: string | null;
  banned_by?: string | null;
  ban_reason?: string | null;
  crypto_public_key?: string | null;
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
