import { useEffect, useMemo, useRef, useState } from "react";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";

import { supabase, supabaseEnabled } from "./supabase";
import type {
  AppUser,
  ChatKind,
  ChatMessage,
  ChatRecord,
  ChatSummary,
  SupabaseChatMemberRow,
  SupabaseChatRow,
  SupabaseMessageRow,
  SupabaseProfileRow,
  WorkspaceData
} from "./types";

const demoSessionKey = "nexa-demo-session-v1";
const demoMessagesKey = "nexa-demo-messages-v1";
const maxMessageLength = 1500;
const universityName = "Nexa University";
const githubRepoUrl = "https://github.com/jessew1lliams/Nexa";
const telegramProviderId = (import.meta.env.VITE_TELEGRAM_PROVIDER_ID ?? "custom:telegram").trim();
const accentPalette = ["#2795FF", "#F77F5A", "#47B39C", "#6D83F2", "#F2C14E", "#7E6BFF"];
const connectionCopy = {
  live: "онлайн",
  reconnecting: "переподключение",
  offline: "офлайн",
  local: "локально"
} as const;
const chatKindCopy: Record<ChatKind, string> = {
  group: "группа",
  direct: "личный чат",
  channel: "канал"
};
const demoUsers: AppUser[] = [
  {
    id: "demo-1",
    name: "Твой аккаунт",
    username: "nexa_user",
    role: "student",
    accentColor: "#2795FF",
    bio: "Личный профиль для знакомства с интерфейсом Nexa."
  },
  {
    id: "demo-2",
    name: "Староста группы",
    username: "group_lead",
    role: "student",
    accentColor: "#F77F5A",
    bio: "Следит, чтобы важные сообщения не терялись."
  },
  {
    id: "demo-3",
    name: "Одногруппник",
    username: "student_room",
    role: "student",
    accentColor: "#47B39C",
    bio: "Всегда на связи в общем чате."
  },
  {
    id: "demo-4",
    name: "Куратор",
    username: "curator",
    role: "curator",
    accentColor: "#6D83F2",
    bio: "Публикует объявления и важные новости."
  }
];
const demoChats: ChatRecord[] = [
  {
    id: "chat-general",
    title: "Nexa / Общий чат",
    kind: "group",
    description: "Главный чат группы для общения и новостей.",
    accentColor: "#2795FF",
    isDefault: true
  },
  {
    id: "chat-labs",
    title: "Лабы и дедлайны",
    kind: "group",
    description: "Вопросы по заданиям, отчётам и защите.",
    accentColor: "#F77F5A"
  },
  {
    id: "chat-curator",
    title: "Куратор / Объявления",
    kind: "channel",
    description: "Важные сообщения, которые лучше не пропускать.",
    accentColor: "#47B39C"
  }
];
const demoMembersByChat: Record<string, string[]> = {
  "chat-general": ["demo-1", "demo-2", "demo-3", "demo-4"],
  "chat-labs": ["demo-1", "demo-2", "demo-3"],
  "chat-curator": ["demo-1", "demo-2", "demo-3", "demo-4"]
};
const demoSeedMessages: Record<string, ChatMessage[]> = {
  "chat-general": [
    {
      id: "msg-1",
      chatId: "chat-general",
      authorId: "demo-4",
      text: "Добро пожаловать в Nexa. Здесь можно общаться всей группой.",
      sentAt: new Date(Date.now() - 90 * 60_000).toISOString()
    },
    {
      id: "msg-2",
      chatId: "chat-general",
      authorId: "demo-1",
      text: "Сайт теперь может жить как GitHub Pages-приложение.",
      sentAt: new Date(Date.now() - 55 * 60_000).toISOString()
    }
  ],
  "chat-labs": [
    {
      id: "msg-3",
      chatId: "chat-labs",
      authorId: "demo-2",
      text: "Если что, сюда можно кидать вопросы по лабораторным.",
      sentAt: new Date(Date.now() - 42 * 60_000).toISOString()
    }
  ],
  "chat-curator": [
    {
      id: "msg-4",
      chatId: "chat-curator",
      authorId: "demo-4",
      text: "После подключения Supabase здесь будет общая переписка для всех устройств.",
      sentAt: new Date(Date.now() - 30 * 60_000).toISOString()
    }
  ]
};

type ConnectionLabel = keyof typeof connectionCopy;
type AuthScreen = "login" | "signup";
type SignMode = "supabase" | "demo";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatTime(isoTimestamp: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoTimestamp));
}

function formatChatStamp(isoTimestamp: string | null) {
  if (!isoTimestamp) {
    return "Пусто";
  }

  const date = new Date(isoTimestamp);
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return formatTime(isoTimestamp);
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short"
  }).format(date);
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
}

function pickAccentColor(seed: string) {
  const index = Math.abs(seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % accentPalette.length;
  return accentPalette[index];
}
function pickFirstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getTelegramIdentityData(user: SupabaseAuthUser) {
  const normalizedProviderId = telegramProviderId.replace(/^custom:/, "");
  const identity = (user.identities ?? []).find(
    (entry) => entry.provider === telegramProviderId || entry.provider === normalizedProviderId
  );

  return (identity?.identity_data ?? {}) as Record<string, unknown>;
}

function getProfileDefaults(user: SupabaseAuthUser) {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const identityData = getTelegramIdentityData(user);
  const combinedName = [pickFirstText(identityData.first_name), pickFirstText(identityData.last_name)].filter(Boolean).join(" ");
  const fullName = pickFirstText(
    metadata.full_name,
    metadata.name,
    identityData.full_name,
    identityData.name,
    combinedName,
    user.email?.split("@")[0],
    "Пользователь Nexa"
  );
  const username = normalizeUsername(
    pickFirstText(
      metadata.username,
      metadata.preferred_username,
      identityData.preferred_username,
      identityData.username,
      user.email?.split("@")[0],
      `user_${user.id.slice(0, 8)}`
    )
  ) || `user_${user.id.slice(0, 8)}`;

  return { fullName, username };
}

function buildPreview(users: AppUser[], currentUserId: string, message: ChatMessage) {
  if (message.authorId === currentUserId) {
    return `Вы: ${message.text}`;
  }

  const author = users.find((user) => user.id === message.authorId);
  const authorName = author?.name.split(" ")[0] ?? "Кто-то";
  return `${authorName}: ${message.text}`;
}

function sortChats(chats: ChatSummary[]) {
  return [...chats].sort((left, right) => {
    const leftTime = left.lastMessageAt ? new Date(left.lastMessageAt).getTime() : 0;
    const rightTime = right.lastMessageAt ? new Date(right.lastMessageAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

function buildWorkspace(args: {
  currentUserId: string;
  users: AppUser[];
  chatRecords: ChatRecord[];
  memberIdsByChat: Record<string, string[]>;
  messagesByChat: Record<string, ChatMessage[]>;
  mode: WorkspaceData["mode"];
  syncLabel: string;
  universityName: string;
}) {
  const currentUser = args.users.find((user) => user.id === args.currentUserId);
  if (!currentUser) {
    throw new Error("Не удалось определить текущего пользователя.");
  }

  const chats = sortChats(
    args.chatRecords.map((chat) => {
      const messages = args.messagesByChat[chat.id] ?? [];
      const lastMessage = messages.at(-1) ?? null;

      return {
        ...chat,
        memberIds: args.memberIdsByChat[chat.id] ?? [],
        lastMessagePreview: lastMessage ? buildPreview(args.users, currentUser.id, lastMessage) : "Пока без сообщений",
        lastMessageAt: lastMessage?.sentAt ?? null,
        unreadCount: 0
      } satisfies ChatSummary;
    })
  );

  return {
    currentUser,
    users: args.users,
    chatRecords: args.chatRecords,
    memberIdsByChat: args.memberIdsByChat,
    chats,
    messagesByChat: args.messagesByChat,
    mode: args.mode,
    syncLabel: args.syncLabel,
    universityName: args.universityName
  } satisfies WorkspaceData;
}

function mapProfileRow(row: SupabaseProfileRow): AppUser {
  return {
    id: row.id,
    email: row.email ?? undefined,
    name: row.full_name,
    username: row.username,
    role: row.role ?? "student",
    accentColor: row.accent_color,
    bio: row.bio ?? "Участник Nexa."
  };
}

function mapChatRow(row: SupabaseChatRow): ChatRecord {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    description: row.description,
    accentColor: row.accent_color,
    isDefault: Boolean(row.is_default)
  };
}

function mapMessageRow(row: SupabaseMessageRow): ChatMessage {
  return {
    id: row.id,
    chatId: row.chat_id,
    authorId: row.author_id,
    text: row.content,
    sentAt: row.created_at
  };
}

function loadDemoSessionUserId() {
  return localStorage.getItem(demoSessionKey);
}

function saveDemoSessionUserId(userId: string | null) {
  if (!userId) {
    localStorage.removeItem(demoSessionKey);
    return;
  }

  localStorage.setItem(demoSessionKey, userId);
}

function loadDemoMessages() {
  try {
    const raw = localStorage.getItem(demoMessagesKey);
    if (!raw) {
      return demoSeedMessages;
    }

    return JSON.parse(raw) as Record<string, ChatMessage[]>;
  } catch {
    return demoSeedMessages;
  }
}

function saveDemoMessages(messagesByChat: Record<string, ChatMessage[]>) {
  localStorage.setItem(demoMessagesKey, JSON.stringify(messagesByChat));
}

function buildDemoWorkspace(userId: string) {
  const currentUser = demoUsers.find((user) => user.id === userId) ?? demoUsers[0];
  return buildWorkspace({
    currentUserId: currentUser.id,
    users: demoUsers,
    chatRecords: demoChats,
    memberIdsByChat: demoMembersByChat,
    messagesByChat: loadDemoMessages(),
    mode: "demo",
    syncLabel: "Лёгкий ознакомительный режим Nexa.",
    universityName
  });
}

function appendDemoMessage(chatId: string, authorId: string, text: string) {
  const messagesByChat = loadDemoMessages();
  const message: ChatMessage = {
    id: `demo-${crypto.randomUUID()}`,
    chatId,
    authorId,
    text,
    sentAt: new Date().toISOString()
  };

  saveDemoMessages({
    ...messagesByChat,
    [chatId]: [...(messagesByChat[chatId] ?? []), message]
  });

  return message;
}

async function ensureSupabaseProfile(user: SupabaseAuthUser) {
  if (!supabase) {
    throw new Error("Supabase клиент не настроен.");
  }

  const { fullName, username } = getProfileDefaults(user);

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        full_name: fullName,
        username,
        role: "student",
        accent_color: pickAccentColor(user.id),
        bio: "Участник Nexa через GitHub Pages + Supabase."
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapProfileRow(data as SupabaseProfileRow);
}

async function ensureDefaultMemberships(userId: string) {
  if (!supabase) {
    return;
  }

  const { data: defaultChats, error } = await supabase.from("chats").select("id").eq("is_default", true);
  if (error) {
    throw new Error(error.message);
  }

  if (!defaultChats?.length) {
    return;
  }

  const { error: membershipError } = await supabase
    .from("chat_members")
    .upsert(
      defaultChats.map((chat) => ({ chat_id: String(chat.id), user_id: userId })),
      { onConflict: "chat_id,user_id", ignoreDuplicates: true }
    );

  if (membershipError) {
    throw new Error(membershipError.message);
  }
}
async function fetchSupabaseWorkspace(user: SupabaseAuthUser) {
  if (!supabase) {
    throw new Error("Supabase клиент не настроен.");
  }

  await ensureSupabaseProfile(user);
  await ensureDefaultMemberships(user.id);

  const { data: ownMemberships, error: ownMembershipError } = await supabase
    .from("chat_members")
    .select("chat_id")
    .eq("user_id", user.id);

  if (ownMembershipError) {
    throw new Error(ownMembershipError.message);
  }

  const chatIds = (ownMemberships ?? []).map((row) => String(row.chat_id));
  if (!chatIds.length) {
    const profile = await ensureSupabaseProfile(user);
    return buildWorkspace({
      currentUserId: profile.id,
      users: [profile],
      chatRecords: [],
      memberIdsByChat: {},
      messagesByChat: {},
      mode: "supabase",
      syncLabel: "Аккаунт готов. Чаты появятся здесь, как только они будут доступны.",
      universityName
    });
  }

  const [{ data: chatRows, error: chatError }, { data: memberRows, error: memberError }, { data: messageRows, error: messageError }] =
    await Promise.all([
      supabase.from("chats").select("*").in("id", chatIds),
      supabase.from("chat_members").select("chat_id,user_id").in("chat_id", chatIds),
      supabase.from("messages").select("*").in("chat_id", chatIds).order("created_at", { ascending: true })
    ]);

  if (chatError) {
    throw new Error(chatError.message);
  }
  if (memberError) {
    throw new Error(memberError.message);
  }
  if (messageError) {
    throw new Error(messageError.message);
  }

  const memberIds = Array.from(new Set((memberRows ?? []).map((row) => String((row as SupabaseChatMemberRow).user_id))));
  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", memberIds.length ? memberIds : [user.id]);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const users = ((profileRows as SupabaseProfileRow[] | null) ?? []).map(mapProfileRow);
  const memberIdsByChat = ((memberRows as SupabaseChatMemberRow[] | null) ?? []).reduce<Record<string, string[]>>((acc, row) => {
    const chatId = String(row.chat_id);
    acc[chatId] = [...(acc[chatId] ?? []), String(row.user_id)];
    return acc;
  }, {});
  const messagesByChat = ((messageRows as SupabaseMessageRow[] | null) ?? []).reduce<Record<string, ChatMessage[]>>((acc, row) => {
    const message = mapMessageRow(row);
    acc[message.chatId] = [...(acc[message.chatId] ?? []), message];
    return acc;
  }, {});

  return buildWorkspace({
    currentUserId: user.id,
    users,
    chatRecords: ((chatRows as SupabaseChatRow[] | null) ?? []).map(mapChatRow),
    memberIdsByChat,
    messagesByChat,
    mode: "supabase",
    syncLabel: "Сообщения синхронизируются между устройствами.",
    universityName
  });
}

function applyIncomingMessage(current: WorkspaceData, message: ChatMessage) {
  const currentMessages = current.messagesByChat[message.chatId] ?? [];
  if (currentMessages.some((entry) => entry.id === message.id)) {
    return current;
  }

  return buildWorkspace({
    currentUserId: current.currentUser.id,
    users: current.users,
    chatRecords: current.chatRecords,
    memberIdsByChat: current.memberIdsByChat,
    messagesByChat: {
      ...current.messagesByChat,
      [message.chatId]: [...currentMessages, message]
    },
    mode: current.mode,
    syncLabel: current.syncLabel,
    universityName: current.universityName
  });
}

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionLabel, setConnectionLabel] = useState<ConnectionLabel>(supabaseEnabled ? "offline" : "local");
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login");
  const [signMode, setSignMode] = useState<SignMode>(supabaseEnabled ? "supabase" : "demo");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const realtimeChannelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);

  const activeChat = workspace?.chats.find((chat) => chat.id === selectedChatId) ?? workspace?.chats[0] ?? null;
  const activeMessages = activeChat ? workspace?.messagesByChat[activeChat.id] ?? [] : [];
  const usersById = useMemo(() => new Map((workspace?.users ?? []).map((user) => [user.id, user])), [workspace?.users]);

  useEffect(() => {
    const demoUserId = loadDemoSessionUserId();
    if (demoUserId) {
      const nextWorkspace = buildDemoWorkspace(demoUserId);
      setWorkspace(nextWorkspace);
      setSelectedChatId(nextWorkspace.chats[0]?.id ?? null);
      setConnectionLabel("local");
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabaseEnabled || !supabase) {
      setIsLoading(false);
      return;
    }

    const client = supabase;
    let ignore = false;

    async function bootstrapSupabase() {
      try {
        const { data, error: userError } = await client.auth.getUser();
        if (userError) {
          throw new Error(userError.message);
        }

        if (ignore) {
          return;
        }

        if (data.user) {
          const nextWorkspace = await fetchSupabaseWorkspace(data.user);
          if (!ignore) {
            setWorkspace(nextWorkspace);
            setSelectedChatId((current) => current ?? nextWorkspace.chats[0]?.id ?? null);
            setSignMode("supabase");
          }
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить Supabase.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    bootstrapSupabase();

    const { data: authListener } = client.auth.onAuthStateChange(async (_event, session) => {
      if (ignore) {
        return;
      }

      if (!session?.user) {
        if (!loadDemoSessionUserId()) {
          setWorkspace(null);
        }
        setConnectionLabel(loadDemoSessionUserId() ? "local" : "offline");
        return;
      }

      try {
        const nextWorkspace = await fetchSupabaseWorkspace(session.user);
        if (!ignore) {
          setWorkspace(nextWorkspace);
          setSelectedChatId((current) => current ?? nextWorkspace.chats[0]?.id ?? null);
          setError(null);
          setNotice("Supabase-сессия обновлена. Теперь чат общий для всех, кто вошёл через сайт.");
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "Не удалось обновить сессию.");
        }
      }
    });

    return () => {
      ignore = true;
      authListener.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!workspace || workspace.mode !== "supabase" || !supabase) {
      if (workspace?.mode === "demo") {
        setConnectionLabel("local");
      }
      return;
    }

    const client = supabase;
    realtimeChannelRef.current?.unsubscribe();
    const channel = client
      .channel(`nexa-messages-${workspace.currentUser.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
        const row = payload.new as SupabaseMessageRow;
        if (!workspace.memberIdsByChat[row.chat_id]) {
          return;
        }

        const message = mapMessageRow(row);
        setWorkspace((current) => (current ? applyIncomingMessage(current, message) : current));

        if (!usersById.has(message.authorId)) {
          const { data } = await client.from("profiles").select("*").eq("id", message.authorId).single();
          if (data) {
            setWorkspace((current) => {
              if (!current) {
                return current;
              }

              const mergedUsers = [...current.users, mapProfileRow(data as SupabaseProfileRow)];
              return buildWorkspace({
                currentUserId: current.currentUser.id,
                users: mergedUsers,
                chatRecords: current.chatRecords,
                memberIdsByChat: current.memberIdsByChat,
                messagesByChat: current.messagesByChat,
                mode: current.mode,
                syncLabel: current.syncLabel,
                universityName: current.universityName
              });
            });
          }
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnectionLabel("live");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionLabel("offline");
        } else if (status === "CLOSED") {
          setConnectionLabel("reconnecting");
        }
      });

    realtimeChannelRef.current = channel;
    return () => {
      channel.unsubscribe();
    };
  }, [workspace, usersById]);

  async function handleSupabaseLogin() {
    if (!supabase) {
      setError("Supabase пока не настроен. Добавь ключи в GitHub Secrets и локальный env.");
      return;
    }

    setIsBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) {
        throw new Error(signInError.message);
      }

      setError(null);
      setNotice("Вход выполнен. Если общий чат уже настроен в Supabase, сообщения будут общими для всех.");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Не удалось войти.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleTelegramLogin() {
    if (!supabase) {
      setError("Общий вход пока недоступен.");
      return;
    }

    setIsBusy(true);
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: telegramProviderId as never,
        options: {
          redirectTo,
          scopes: "openid profile"
        }
      });

      if (oauthError) {
        throw oauthError;
      }

      if (data?.url) {
        window.location.assign(data.url);
      }
    } catch {
      setError("Telegram-вход пока не готов. Сначала подключи Telegram как OIDC-провайдер в Supabase.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSupabaseSignup() {
    if (!supabase) {
      setError("Supabase пока не настроен. Добавь ключи в GitHub Secrets и локальный env.");
      return;
    }

    const cleanUsername = normalizeUsername(username);
    if (!fullName.trim() || !cleanUsername) {
      setError("Укажи имя и username латиницей, чтобы создать аккаунт.");
      return;
    }

    setIsBusy(true);
    try {
      const { error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            username: cleanUsername
          }
        }
      });

      if (signupError) {
        throw new Error(signupError.message);
      }

      setError(null);
      setNotice("Аккаунт создан. Если в Supabase включено подтверждение email, открой письмо и подтверди вход.");
      setAuthScreen("login");
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : "Не удалось создать аккаунт.");
    } finally {
      setIsBusy(false);
    }
  }

  function handleDemoLogin(userId: string) {
    saveDemoSessionUserId(userId);
    const nextWorkspace = buildDemoWorkspace(userId);
    setWorkspace(nextWorkspace);
    setSelectedChatId(nextWorkspace.chats[0]?.id ?? null);
    setConnectionLabel("local");
    setError(null);
    setNotice("Добро пожаловать в Nexa.");
  }

  async function handleLogout() {
    if (workspace?.mode === "supabase" && supabase) {
      await supabase.auth.signOut();
    }

    if (workspace?.mode === "demo") {
      saveDemoSessionUserId(null);
    }

    setWorkspace(null);
    setSelectedChatId(null);
    setDraft("");
    setNotice(null);
    setConnectionLabel(supabaseEnabled ? "offline" : "local");
  }

  async function handleSendMessage() {
    if (!workspace || !activeChat) {
      return;
    }

    const text = draft.trim();
    if (!text) {
      return;
    }

    if (text.length > maxMessageLength) {
      setError(`Сообщение слишком длинное. Максимум ${maxMessageLength} символов.`);
      return;
    }

    setIsBusy(true);
    try {
      if (workspace.mode === "demo") {
        const message = appendDemoMessage(activeChat.id, workspace.currentUser.id, text);
        setWorkspace(buildDemoWorkspace(workspace.currentUser.id));
        setSelectedChatId(activeChat.id);
        setDraft("");
        setError(null);
        setNotice(`Демо-сообщение сохранено на этом устройстве в ${formatTime(message.sentAt)}.`);
        return;
      }

      if (!supabase) {
        throw new Error("Supabase не подключён.");
      }

      const { data, error: insertError } = await supabase
        .from("messages")
        .insert({ chat_id: activeChat.id, author_id: workspace.currentUser.id, content: text })
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      setWorkspace((current) => (current ? applyIncomingMessage(current, mapMessageRow(data as SupabaseMessageRow)) : current));
      setDraft("");
      setError(null);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Сообщение не отправилось.");
    } finally {
      setIsBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="center-state">
        <div className="loading-card panel">
          <span className="eyebrow">Nexa запускается</span>
          <h1>Подготавливаю сайт для GitHub Pages</h1>
          <p>Проверяю локальную сессию, Supabase и состояние твоего мессенджера.</p>
        </div>
      </div>
    );
  }
  if (!workspace) {
    return (
      <div className="login-shell">
        <section className="brand-card panel">
          <span className="eyebrow">private campus messenger</span>
          <h1>Nexa</h1>
          <p className="brand-copy">
            Закрытый мессенджер с аккуратным интерфейсом, быстрыми чатами и пространством только для своих.
          </p>
          <div className="hero-note">
            <strong>Открытый код</strong>
            <p>
              Весь код проекта лежит на GitHub, поэтому любой может сам посмотреть, как устроен сайт, и проверить его безопасность.
            </p>
            <a className="hero-link" href={githubRepoUrl} target="_blank" rel="noreferrer">
              Открыть репозиторий
            </a>
          </div>
        </section>

        <section className="auth-card panel">
          <div className="auth-header">
            <span className="eyebrow">доступ</span>
            <h2>Войти в Nexa</h2>
            <p>Можно войти через Telegram, обычный аккаунт или быстро открыть демо-версию, чтобы сразу посмотреть интерфейс.</p>
          </div>

          <div className="auth-toggle-row">
            <button type="button" className={`toggle-pill ${signMode === "supabase" ? "is-active" : ""}`} onClick={() => setSignMode("supabase")} disabled={!supabaseEnabled}>Аккаунт</button>
            <button type="button" className={`toggle-pill ${signMode === "demo" ? "is-active" : ""}`} onClick={() => setSignMode("demo")}>Быстрый вход</button>
          </div>

          {signMode === "supabase" ? (
            <div className="auth-form">
              {!supabaseEnabled ? (
                <div className="helper-card">
                  <strong>Общий вход пока недоступен.</strong>
                  <p>Пока можно спокойно открыть Nexa через быстрый вход и посмотреть интерфейс без лишней настройки.</p>
                </div>
              ) : null}

              <button type="button" className="telegram-button" onClick={handleTelegramLogin} disabled={isBusy || !supabaseEnabled}>
                Войти через Telegram
              </button>

              <div className="divider">или</div>

              <div className="auth-toggle-row compact-row">
                <button type="button" className={`toggle-pill ${authScreen === "login" ? "is-active" : ""}`} onClick={() => setAuthScreen("login")}>Вход</button>
                <button type="button" className={`toggle-pill ${authScreen === "signup" ? "is-active" : ""}`} onClick={() => setAuthScreen("signup")}>Регистрация</button>
              </div>

              {authScreen === "signup" ? (
                <>
                  <input className="field" placeholder="Имя и фамилия" value={fullName} onChange={(event) => setFullName(event.target.value)} />
                  <input className="field" placeholder="username латиницей" value={username} onChange={(event) => setUsername(event.target.value)} />
                </>
              ) : null}

              <input className="field" placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <input className="field" placeholder="Пароль" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />

              <button type="button" className="primary-button" onClick={authScreen === "login" ? handleSupabaseLogin : handleSupabaseSignup} disabled={isBusy || !supabaseEnabled}>
                {authScreen === "login" ? "Войти" : "Создать аккаунт"}
              </button>
            </div>
          ) : (
            <div className="helper-card demo-entry">
              <strong>Быстрый вход</strong>
              <p>Открой Nexa без лишних экранов и просто посмотри, как выглядит мессенджер.</p>
              <button type="button" className="primary-button" onClick={() => handleDemoLogin("demo-1")} disabled={isBusy}>
                Открыть Nexa
              </button>
            </div>
          )}

          {notice ? <p className="notice-text">{notice}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar panel">
        <div className="sidebar-top">
          <div>
            <span className="eyebrow">nexa online</span>
            <h1>Nexa</h1>
          </div>
          <span className={`status-chip status-${connectionLabel}`}>{connectionCopy[connectionLabel]}</span>
        </div>

        <div className="search-shell">
          <input className="search-input" value="Приватное пространство Nexa" readOnly />
        </div>

        <div className="sidebar-pills">
          <span className="soft-pill">{workspace.universityName}</span>
          <span className="soft-pill">{workspace.mode === "supabase" ? "живой режим" : "предпросмотр"}</span>
        </div>

        <div className="chat-list">
          {workspace.chats.map((chat) => (
            <button type="button" key={chat.id} className={`chat-row ${activeChat?.id === chat.id ? "is-active" : ""}`} onClick={() => setSelectedChatId(chat.id)}>
              <span className="avatar" style={{ backgroundColor: chat.accentColor }}>{getInitials(chat.title)}</span>
              <span className="chat-copy">
                <span className="chat-copy-head">
                  <strong>{chat.title}</strong>
                  <span>{formatChatStamp(chat.lastMessageAt)}</span>
                </span>
                <span className="chat-preview">{chat.lastMessagePreview}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="conversation panel">
        {activeChat ? (
          <>
            <header className="conversation-top">
              <div className="conversation-meta">
                <span className="avatar large" style={{ backgroundColor: activeChat.accentColor }}>{getInitials(activeChat.title)}</span>
                <div>
                  <h2>{activeChat.title}</h2>
                  <p>{activeChat.description}</p>
                </div>
              </div>
              <div className="conversation-badges">
                <span className="soft-pill">{chatKindCopy[activeChat.kind]}</span>
                <span className="soft-pill">{activeChat.memberIds.length} участников</span>
              </div>
            </header>

            <div className="message-list">
              {activeMessages.map((message) => {
                const author = usersById.get(message.authorId);
                const isOwnMessage = message.authorId === workspace.currentUser.id;

                return (
                  <article key={message.id} className={`message-bubble ${isOwnMessage ? "own" : ""}`}>
                    {!isOwnMessage ? <span className="message-author" style={{ color: author?.accentColor }}>{author?.name ?? "Неизвестный участник"}</span> : null}
                    <p>{message.text}</p>
                    <span className="message-time">{formatTime(message.sentAt)}</span>
                  </article>
                );
              })}
            </div>

            <footer className="composer">
              <div className="composer-stack">
                <textarea
                  className="composer-input"
                  placeholder="Напиши сообщение в Nexa..."
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value.slice(0, maxMessageLength));
                    if (error) setError(null);
                  }}
                  rows={1}
                />
                <div className="composer-meta">
                  <span className="char-counter">{draft.length}/{maxMessageLength}</span>
                </div>
              </div>
              <button type="button" className="primary-button compact" onClick={handleSendMessage} disabled={isBusy || !draft.trim()}>Отправить</button>
            </footer>
          </>
        ) : (
          <div className="empty-state">
            <h2>Пока нет чатов</h2>
            <p>Если ты уже подключил Supabase, проверь SQL-схему и наличие default-чата.</p>
          </div>
        )}
      </main>

      <aside className="details-rail panel">
        <div className="profile-card">
          <span className="avatar xl" style={{ backgroundColor: workspace.currentUser.accentColor }}>{getInitials(workspace.currentUser.name)}</span>
          <h2>{workspace.currentUser.name}</h2>
          <p>@{workspace.currentUser.username}</p>
          <p>{workspace.currentUser.bio}</p>
        </div>

        <div className="detail-section">
          <span className="eyebrow">пространство nexa</span>
          <p>{workspace.syncLabel}</p>
          <p>{workspace.mode === "supabase" ? "Переписка остаётся актуальной на разных устройствах." : "Это спокойный режим для знакомства с интерфейсом и общим стилем приложения."}</p>
        </div>

        <div className="detail-section">
          <span className="eyebrow">о проекте</span>
          <ul className="detail-list">
            <li>Лаконичный интерфейс без лишнего шума.</li>
            <li>Чаты и сообщения собраны в одном приватном пространстве.</li>
            <li>Весь код проекта доступен на GitHub.</li>
          </ul>
        </div>

        {notice ? <p className="notice-text">{notice}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        <button type="button" className="ghost-button" onClick={handleLogout}>Выйти</button>
      </aside>
    </div>
  );
}

export default App;


