import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
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
const profileOverridesKey = "nexa-profile-overrides-v1";
const rememberedUsersKey = "nexa-remembered-users-v1";
const workspaceCacheKey = "nexa-workspace-cache-v2";
const directoryCacheKey = "nexa-directory-users-v2";
const maxMessageLength = 1500;
const universityName = "Nexa University";
const githubRepoUrl = "https://github.com/jessew1lliams/Nexa";
const brandLogoUrl = `${import.meta.env.BASE_URL}nexa-logo.png`;
const telegramProviderId = (import.meta.env.VITE_TELEGRAM_PROVIDER_ID ?? "custom:telegram").trim();
const defaultChatId = "11111111-1111-4111-8111-111111111111";
const defaultFallbackChat: ChatRecord = {
  id: defaultChatId,
  title: "Nexa / Общий чат",
  kind: "group",
  description: "Главный чат сообщества Nexa.",
  accentColor: "#2795FF",
  isDefault: true
};
const accentPalette = ["#2795FF", "#F77F5A", "#47B39C", "#6D83F2", "#F2C14E", "#7E6BFF"];
const connectionCopy = {
  live: "РѕРЅР»Р°Р№РЅ",
  reconnecting: "РїРµСЂРµРїРѕРґРєР»СЋС‡РµРЅРёРµ",
  offline: "РѕС„Р»Р°Р№РЅ",
  local: "Р»РѕРєР°Р»СЊРЅРѕ"
} as const;
const chatKindCopy: Record<ChatKind, string> = {
  group: "РіСЂСѓРїРїР°",
  direct: "Р»РёС‡РЅС‹Р№ С‡Р°С‚",
  channel: "РєР°РЅР°Р»"
};
const demoUsers: AppUser[] = [
  {
    id: "demo-1",
    name: "РўРІРѕР№ Р°РєРєР°СѓРЅС‚",
    username: "nexa_user",
    role: "student",
    accentColor: "#2795FF",
    bio: "Р›РёС‡РЅС‹Р№ РїСЂРѕС„РёР»СЊ РґР»СЏ Р·РЅР°РєРѕРјСЃС‚РІР° СЃ РёРЅС‚РµСЂС„РµР№СЃРѕРј Nexa."
  },
  {
    id: "demo-2",
    name: "РЎС‚Р°СЂРѕСЃС‚Р° РіСЂСѓРїРїС‹",
    username: "group_lead",
    role: "student",
    accentColor: "#F77F5A",
    bio: "РЎР»РµРґРёС‚, С‡С‚РѕР±С‹ РІР°Р¶РЅС‹Рµ СЃРѕРѕР±С‰РµРЅРёСЏ РЅРµ С‚РµСЂСЏР»РёСЃСЊ."
  },
  {
    id: "demo-3",
    name: "РћРґРЅРѕРіСЂСѓРїРїРЅРёРє",
    username: "student_room",
    role: "student",
    accentColor: "#47B39C",
    bio: "Р’СЃРµРіРґР° РЅР° СЃРІСЏР·Рё РІ РѕР±С‰РµРј С‡Р°С‚Рµ."
  },
  {
    id: "demo-4",
    name: "РљСѓСЂР°С‚РѕСЂ",
    username: "curator",
    role: "curator",
    accentColor: "#6D83F2",
    bio: "РџСѓР±Р»РёРєСѓРµС‚ РѕР±СЉСЏРІР»РµРЅРёСЏ Рё РІР°Р¶РЅС‹Рµ РЅРѕРІРѕСЃС‚Рё."
  }
];
const demoChats: ChatRecord[] = [
  {
    id: "chat-general",
    title: "Nexa / РћР±С‰РёР№ С‡Р°С‚",
    kind: "group",
    description: "Р“Р»Р°РІРЅС‹Р№ С‡Р°С‚ РіСЂСѓРїРїС‹ РґР»СЏ РѕР±С‰РµРЅРёСЏ Рё РЅРѕРІРѕСЃС‚РµР№.",
    accentColor: "#2795FF",
    isDefault: true
  },
  {
    id: "chat-labs",
    title: "Р›Р°Р±С‹ Рё РґРµРґР»Р°Р№РЅС‹",
    kind: "group",
    description: "Р’РѕРїСЂРѕСЃС‹ РїРѕ Р·Р°РґР°РЅРёСЏРј, РѕС‚С‡С‘С‚Р°Рј Рё Р·Р°С‰РёС‚Рµ.",
    accentColor: "#F77F5A"
  },
  {
    id: "chat-curator",
    title: "РљСѓСЂР°С‚РѕСЂ / РћР±СЉСЏРІР»РµРЅРёСЏ",
    kind: "channel",
    description: "Р’Р°Р¶РЅС‹Рµ СЃРѕРѕР±С‰РµРЅРёСЏ, РєРѕС‚РѕСЂС‹Рµ Р»СѓС‡С€Рµ РЅРµ РїСЂРѕРїСѓСЃРєР°С‚СЊ.",
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
      text: "Р”РѕР±СЂРѕ РїРѕР¶Р°Р»РѕРІР°С‚СЊ РІ Nexa. Р—РґРµСЃСЊ РјРѕР¶РЅРѕ РѕР±С‰Р°С‚СЊСЃСЏ РІСЃРµР№ РіСЂСѓРїРїРѕР№.",
      sentAt: new Date(Date.now() - 90 * 60_000).toISOString()
    },
    {
      id: "msg-2",
      chatId: "chat-general",
      authorId: "demo-1",
      text: "РЎР°Р№С‚ С‚РµРїРµСЂСЊ РјРѕР¶РµС‚ Р¶РёС‚СЊ РєР°Рє GitHub Pages-РїСЂРёР»РѕР¶РµРЅРёРµ.",
      sentAt: new Date(Date.now() - 55 * 60_000).toISOString()
    }
  ],
  "chat-labs": [
    {
      id: "msg-3",
      chatId: "chat-labs",
      authorId: "demo-2",
      text: "Р•СЃР»Рё С‡С‚Рѕ, СЃСЋРґР° РјРѕР¶РЅРѕ РєРёРґР°С‚СЊ РІРѕРїСЂРѕСЃС‹ РїРѕ Р»Р°Р±РѕСЂР°С‚РѕСЂРЅС‹Рј.",
      sentAt: new Date(Date.now() - 42 * 60_000).toISOString()
    }
  ],
  "chat-curator": [
    {
      id: "msg-4",
      chatId: "chat-curator",
      authorId: "demo-4",
      text: "РџРѕСЃР»Рµ РїРѕРґРєР»СЋС‡РµРЅРёСЏ Supabase Р·РґРµСЃСЊ Р±СѓРґРµС‚ РѕР±С‰Р°СЏ РїРµСЂРµРїРёСЃРєР° РґР»СЏ РІСЃРµС… СѓСЃС‚СЂРѕР№СЃС‚РІ.",
      sentAt: new Date(Date.now() - 30 * 60_000).toISOString()
    }
  ]
};

type ConnectionLabel = keyof typeof connectionCopy;
type AuthScreen = "login" | "signup";
type SignMode = "supabase" | "demo";

type RememberedDeviceUser = Pick<AppUser, "id" | "name" | "username" | "accentColor" | "avatarUrl" | "role"> & {
  lastSeenAt: string;
};

type CachedWorkspacePayload = {
  workspace: WorkspaceData;
  selectedChatId: string | null;
  cachedAt: string;
};

function mapRememberedUserToAppUser(user: RememberedDeviceUser): AppUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    accentColor: user.accentColor,
    avatarUrl: user.avatarUrl,
    bio: "Профиль, который уже входил в Nexa на этом устройстве."
  };
}

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
    return "РџСѓСЃС‚Рѕ";
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

function formatRememberedStamp(isoTimestamp: string) {
  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  if (diffHours < 1) {
    return "Сейчас на устройстве";
  }

  if (diffHours < 24) {
    return `${diffHours} ч назад`;
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

function buildStableUuid(seed: string) {
  let a = 0x811c9dc5;
  let b = 0x9e3779b1;
  let c = 0x85ebca6b;
  let d = 0xc2b2ae35;

  for (const char of seed) {
    const code = char.charCodeAt(0);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x27d4eb2d) >>> 0;
    c = Math.imul(c ^ code, 0x165667b1) >>> 0;
    d = Math.imul(d ^ code, 0x85ebca77) >>> 0;
  }

  const hex = [a, b, c, d]
    .map((value) => value.toString(16).padStart(8, "0"))
    .join("")
    .slice(0, 32);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function buildDirectChatId(leftUserId: string, rightUserId: string) {
  return buildStableUuid([leftUserId, rightUserId].sort().join(":"));
}

function pickFirstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function formatUiErrorMessage(error: unknown, fallback: string) {
  const rawMessage = error instanceof Error ? error.message.trim() : "";
  const normalized = rawMessage.toLowerCase();

  if (!rawMessage) {
    return fallback;
  }

  if (normalized.includes("auth session missing")) {
    return "\u0412\u0445\u043e\u0434 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043d. \u0410\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u044e \u043c\u043e\u0436\u043d\u043e \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u0435\u0449\u0451 \u0440\u0430\u0437.";
  }

  if (normalized.includes("auth session missing")) {
    return "Вход больше не подтверждён. Авторизацию можно запустить ещё раз.";
  }

  if (normalized.includes("issued in the future") || normalized.includes("clock for skew") || normalized.includes("device clock")) {
    return "\u0412\u0440\u0435\u043c\u044f \u043d\u0430 \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0435 \u043e\u0442\u043b\u0438\u0447\u0430\u0435\u0442\u0441\u044f \u043e\u0442 \u0441\u0435\u0440\u0432\u0435\u0440\u043d\u043e\u0433\u043e. \u041d\u0443\u0436\u043d\u043e \u043f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u0434\u0430\u0442\u0443 \u0438 \u0432\u0440\u0435\u043c\u044f.";
  }

  if (normalized.includes("update your telegram app") || normalized.includes("confirm the login request from the website")) {
    return "\u0422\u0435\u043a\u0443\u0449\u0430\u044f \u0432\u0435\u0440\u0441\u0438\u044f Telegram \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u044d\u0442\u043e\u0442 \u0442\u0438\u043f \u0432\u0445\u043e\u0434\u0430.";
  }

  if (
    (normalized.includes("relation") && normalized.includes("does not exist")) ||
    normalized.includes("schema cache") ||
    normalized.includes("could not find the table") ||
    normalized.includes("foreign key constraint")
  ) {
    return "\u0411\u0430\u0437\u0430 Nexa \u0432 Supabase \u0435\u0449\u0451 \u043d\u0435 \u043f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u043b\u0435\u043d\u0430. \u041d\u0443\u0436\u043d\u043e \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c SQL-\u0441\u0445\u0435\u043c\u0443 \u043f\u0440\u043e\u0435\u043a\u0442\u0430.";
  }

  if (normalized.includes("row-level security")) {
    return "\u0414\u043e\u0441\u0442\u0443\u043f \u043a \u0442\u0430\u0431\u043b\u0438\u0446\u0430\u043c Nexa \u0432 Supabase \u0435\u0449\u0451 \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d.";
  }

  if (
    normalized.includes("status of 500") ||
    normalized.includes("unexpected_failure") ||
    normalized.includes("infinite recursion") ||
    normalized.includes("stack depth") ||
    normalized.includes("database error") ||
    normalized.includes("permission denied")
  ) {
    return "\u041f\u0440\u0430\u0432\u0438\u043b\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u0430 \u0432 Supabase \u0441\u0435\u0439\u0447\u0430\u0441 \u043c\u0435\u0448\u0430\u044e\u0442 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0435 \u0447\u0430\u0442\u043e\u0432. \u041d\u0443\u0436\u0435\u043d SQL-\u043f\u0430\u0442\u0447 \u043f\u0440\u043e\u0435\u043a\u0442\u0430.";
  }

  if (normalized.includes("failed to fetch") || normalized.includes("network")) {
    return "\u0421\u0432\u044f\u0437\u044c \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u043e\u043c \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430. \u0410\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u044e \u043c\u043e\u0436\u043d\u043e \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c \u043f\u043e\u0437\u0436\u0435.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "\u0410\u043a\u043a\u0430\u0443\u043d\u0442 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d \u0438\u043b\u0438 \u0434\u0430\u043d\u043d\u044b\u0435 \u0432\u0432\u0435\u0434\u0435\u043d\u044b \u043d\u0435\u0432\u0435\u0440\u043d\u043e.";
  }

  if (normalized.includes("email not confirmed")) {
    return "\u041f\u043e\u0447\u0442\u0430 \u0435\u0449\u0451 \u043d\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0430.";
  }

  if (looksLikeMojibake(rawMessage)) {
    return fallback;
  }

  if (/^[\x00-\x7F]+$/.test(rawMessage)) {
    return fallback;
  }

  return rawMessage;
}

function looksLikeMojibake(value: string) {
  return ["Рџ", "РЎ", "Рќ", "СЃ", "С‚", "Р°", "Рё", "Рµ", "вЂ", "в„–"].filter((fragment) => value.includes(fragment)).length >= 2;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.trim() : "";
}

function looksLikeSupabaseAccessIssue(error: unknown) {
  const normalized = getErrorMessage(error).toLowerCase();

  return [
    "row-level security",
    "status of 500",
    "unexpected_failure",
    "infinite recursion",
    "stack depth",
    "database error",
    "permission denied",
    "schema cache",
    "relation"
  ].some((pattern) => normalized.includes(pattern));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timer);
        reject(error);
      }
    );
  });
}
function readAuthCallbackMessage() {
  if (typeof window === "undefined") {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "");
  const rawMessage =
    searchParams.get("error_description") ??
    searchParams.get("error") ??
    hashParams.get("error_description") ??
    hashParams.get("error");

  if (!rawMessage) {
    return null;
  }

  return formatUiErrorMessage(
    new Error(rawMessage),
    "\u0412\u0445\u043e\u0434 \u043d\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043b\u0441\u044f. \u0410\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u044e \u043c\u043e\u0436\u043d\u043e \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u0435\u0449\u0451 \u0440\u0430\u0437."
  );
}

function clearAuthCallbackUrl() {
  if (typeof window === "undefined") {
    return;
  }

  window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}`);
}

function hasAuthCallbackParams() {
  if (typeof window === "undefined") {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "");

  return [
    searchParams.get("code"),
    searchParams.get("error"),
    searchParams.get("error_description"),
    hashParams.get("access_token"),
    hashParams.get("refresh_token"),
    hashParams.get("provider_token"),
    hashParams.get("error"),
    hashParams.get("error_description")
  ].some(Boolean);
}
function getIdentityData(user: SupabaseAuthUser, providerId?: string) {
  const identities = user.identities ?? [];

  if (!providerId) {
    return (identities[0]?.identity_data ?? {}) as Record<string, unknown>;
  }

  const normalizedProviderId = providerId.replace(/^custom:/, "");
  const identity = identities.find((entry) => entry.provider === providerId || entry.provider === normalizedProviderId);

  return (identity?.identity_data ?? identities[0]?.identity_data ?? {}) as Record<string, unknown>;
}

function getProfileDefaults(user: SupabaseAuthUser) {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const activeProvider = pickFirstText(appMetadata.provider);
  const identityData = getIdentityData(user, activeProvider);
  const combinedName = [pickFirstText(identityData.first_name), pickFirstText(identityData.last_name)].filter(Boolean).join(" ");
  const fullName = pickFirstText(
    metadata.full_name,
    metadata.name,
    identityData.full_name,
    identityData.name,
    combinedName,
    user.email?.split("@")[0],
    "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ Nexa"
  );
  const username = normalizeUsername(
    pickFirstText(
      metadata.username,
      metadata.preferred_username,
      metadata.screen_name,
      metadata.domain,
      identityData.preferred_username,
      identityData.username,
      identityData.screen_name,
      identityData.domain,
      identityData.nickname,
      user.email?.split("@")[0],
      `user_${user.id.slice(0, 8)}`
    )
  ) || `user_${user.id.slice(0, 8)}`;

  return { fullName, username };
}

function getProfileAvatarDefault(user: SupabaseAuthUser) {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const activeProvider = pickFirstText(appMetadata.provider);
  const identityData = getIdentityData(user, activeProvider);

  return (
    pickFirstText(
      metadata.avatar_url,
      metadata.picture,
      metadata.photo,
      metadata.photo_200,
      metadata.photo_100,
      identityData.avatar_url,
      identityData.picture,
      identityData.photo,
      identityData.photo_200,
      identityData.photo_100,
      identityData.photo_max_orig
    ) || undefined
  );
}

function mergeUsersById(...groups: AppUser[][]) {
  const merged = new Map<string, AppUser>();

  for (const group of groups) {
    for (const user of group) {
      merged.set(user.id, user);
    }
  }

  return Array.from(merged.values());
}

function mergeWorkspaceUsers(current: WorkspaceData, incomingUsers: AppUser[]) {
  const nextUsers = mergeUsersById(current.users, incomingUsers);

  return buildWorkspace({
    currentUserId: current.currentUser.id,
    users: nextUsers,
    chatRecords: current.chatRecords,
    memberIdsByChat: current.memberIdsByChat,
    messagesByChat: current.messagesByChat,
    mode: current.mode,
    syncLabel: current.syncLabel,
    universityName: current.universityName
  });
}

function upsertLocalDirectChat(current: WorkspaceData, target: AppUser, chatId: string) {
  if (current.chatRecords.some((chat) => chat.id === chatId)) {
    return current;
  }

  const nextChatRecord: ChatRecord = {
    id: chatId,
    title: target.name,
    kind: "direct",
    description: `@${target.username}`,
    accentColor: target.accentColor,
    isDefault: false
  };

  return buildWorkspace({
    currentUserId: current.currentUser.id,
    users: mergeUsersById(current.users, [target]),
    chatRecords: [nextChatRecord, ...current.chatRecords],
    memberIdsByChat: {
      ...current.memberIdsByChat,
      [chatId]: [current.currentUser.id, target.id]
    },
    messagesByChat: {
      ...current.messagesByChat,
      [chatId]: current.messagesByChat[chatId] ?? []
    },
    mode: current.mode,
    syncLabel: current.syncLabel,
    universityName: current.universityName
  });
}

function buildAuthFallbackProfile(user: SupabaseAuthUser): AppUser {
  const { fullName, username } = getProfileDefaults(user);
  const avatarUrl = getProfileAvatarDefault(user);

  return applyProfileOverride({
    id: user.id,
    email: user.email ?? undefined,
    name: fullName,
    username,
    role: "student",
    accentColor: pickAccentColor(user.id),
    avatarUrl,
    bio: "Участник Nexa."
  });
}

function renderAvatar(options: {
  label: string;
  accentColor: string;
  imageUrl?: string;
  className?: string;
}) {
  const { label, accentColor, imageUrl, className } = options;

  return (
    <span className={className ? `avatar ${className}` : "avatar"} style={{ backgroundColor: accentColor }}>
      {imageUrl ? <img className="avatar-image" src={imageUrl} alt={label} /> : <span className="avatar-fallback">{getInitials(label)}</span>}
    </span>
  );
}

function buildPreview(users: AppUser[], currentUserId: string, message: ChatMessage) {
  if (message.authorId === currentUserId) {
    return `Р’С‹: ${message.text}`;
  }

  const author = users.find((user) => user.id === message.authorId);
  const authorName = author?.name.split(" ")[0] ?? "РљС‚Рѕ-С‚Рѕ";
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
    throw new Error("РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.");
  }

  const chats = sortChats(
    args.chatRecords.map((chat) => {
      const messages = args.messagesByChat[chat.id] ?? [];
      const lastMessage = messages.at(-1) ?? null;
      const memberIds = args.memberIdsByChat[chat.id] ?? [];
      const peerUser =
        chat.kind === "direct"
          ? args.users.find((user) => memberIds.includes(user.id) && user.id !== currentUser.id) ?? null
          : null;

      return {
        ...chat,
        title: peerUser?.name ?? chat.title,
        description: chat.kind === "direct" ? (peerUser ? `@${peerUser.username}` : chat.description) : chat.description,
        accentColor: peerUser?.accentColor ?? chat.accentColor,
        memberIds,
        lastMessagePreview: lastMessage
          ? buildPreview(args.users, currentUser.id, lastMessage)
          : "\u041f\u043e\u043a\u0430 \u0431\u0435\u0437 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439",
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

function ensureWorkspaceBaseline(workspace: WorkspaceData) {
  const hasDefaultChat = workspace.chatRecords.some((chat) => chat.id === defaultChatId);
  const defaultMemberIds = Array.from(new Set([workspace.currentUser.id, ...(workspace.memberIdsByChat[defaultChatId] ?? [])]));

  if (hasDefaultChat && defaultMemberIds.length === (workspace.memberIdsByChat[defaultChatId] ?? []).length) {
    return workspace;
  }

  const nextChatRecords = hasDefaultChat ? workspace.chatRecords : [defaultFallbackChat, ...workspace.chatRecords];

  return buildWorkspace({
    currentUserId: workspace.currentUser.id,
    users: workspace.users,
    chatRecords: nextChatRecords,
    memberIdsByChat: {
      ...workspace.memberIdsByChat,
      [defaultChatId]: defaultMemberIds
    },
    messagesByChat: {
      ...workspace.messagesByChat,
      [defaultChatId]: workspace.messagesByChat[defaultChatId] ?? []
    },
    mode: workspace.mode,
    syncLabel: workspace.syncLabel,
    universityName: workspace.universityName
  });
}

function mapProfileRow(row: SupabaseProfileRow): AppUser {
  return applyProfileOverride({
    id: row.id,
    email: row.email ?? undefined,
    name: row.full_name,
    username: row.username,
    role: row.role ?? "student",
    accentColor: row.accent_color,
    bio: row.bio ?? "РЈС‡Р°СЃС‚РЅРёРє Nexa.",
    avatarUrl: row.avatar_url ?? undefined
  });
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

function readProfileOverrides() {
  if (typeof window === "undefined") {
    return {} as Record<string, Partial<Pick<AppUser, "name" | "avatarUrl">>>;
  }

  try {
    const raw = window.localStorage.getItem(profileOverridesKey);
    return raw ? (JSON.parse(raw) as Record<string, Partial<Pick<AppUser, "name" | "avatarUrl">>>) : {};
  } catch {
    return {};
  }
}

function getStoredProfileOverride(userId: string) {
  return readProfileOverrides()[userId] ?? {};
}

function saveProfileOverride(userId: string, override: Partial<Pick<AppUser, "name" | "avatarUrl">>) {
  if (typeof window === "undefined") {
    return;
  }

  const current = readProfileOverrides();
  current[userId] = {
    ...current[userId],
    ...override
  };

  window.localStorage.setItem(profileOverridesKey, JSON.stringify(current));
}

function readRememberedUsers() {
  if (typeof window === "undefined") {
    return [] as RememberedDeviceUser[];
  }

  try {
    const raw = window.localStorage.getItem(rememberedUsersKey);
    const parsed = raw ? (JSON.parse(raw) as RememberedDeviceUser[]) : [];

    return parsed
      .filter((entry) => entry?.id && entry?.name && entry?.username)
      .sort((left, right) => new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime())
      .slice(0, 6);
  } catch {
    return [];
  }
}

function rememberDeviceUser(user: AppUser) {
  if (typeof window === "undefined") {
    return [] as RememberedDeviceUser[];
  }

  const nextEntry: RememberedDeviceUser = {
    id: user.id,
    name: user.name,
    username: user.username,
    accentColor: user.accentColor,
    avatarUrl: user.avatarUrl,
    role: user.role,
    lastSeenAt: new Date().toISOString()
  };

  const merged = [nextEntry, ...readRememberedUsers().filter((entry) => entry.id !== user.id)].slice(0, 6);
  window.localStorage.setItem(rememberedUsersKey, JSON.stringify(merged));
  return merged;
}

function readCachedDirectoryUsers() {
  if (typeof window === "undefined") {
    return [] as AppUser[];
  }

  try {
    const raw = window.localStorage.getItem(directoryCacheKey);
    const parsed = raw ? (JSON.parse(raw) as AppUser[]) : [];
    return parsed.filter((entry) => entry?.id && entry?.name && entry?.username).slice(0, 120);
  } catch {
    return [];
  }
}

function saveCachedDirectoryUsers(users: AppUser[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(directoryCacheKey, JSON.stringify(users.slice(0, 120)));
}

function buildCachedWorkspace(workspace: WorkspaceData): WorkspaceData {
  const cachedMessagesByChat = Object.fromEntries(
    Object.entries(workspace.messagesByChat).map(([chatId, messages]) => [chatId, messages.slice(-16)])
  );
  const cachedUsers = [workspace.currentUser, ...workspace.users.filter((user) => user.id !== workspace.currentUser.id)].slice(0, 80);

  return ensureWorkspaceBaseline({
    ...workspace,
    users: cachedUsers,
    messagesByChat: cachedMessagesByChat
  });
}

function loadWorkspaceCache() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(workspaceCacheKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedWorkspacePayload | null;
    if (!parsed?.workspace?.currentUser?.id) {
      return null;
    }

    return {
      ...parsed,
      workspace: ensureWorkspaceBaseline(parsed.workspace)
    };
  } catch {
    return null;
  }
}

function saveWorkspaceCache(workspace: WorkspaceData, selectedChatId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: CachedWorkspacePayload = {
    workspace: buildCachedWorkspace(workspace),
    selectedChatId,
    cachedAt: new Date().toISOString()
  };

  window.localStorage.setItem(workspaceCacheKey, JSON.stringify(payload));
}

function clearWorkspaceCache() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(workspaceCacheKey);
  window.localStorage.removeItem(directoryCacheKey);
}

function applyProfileOverride(user: AppUser) {
  const override = getStoredProfileOverride(user.id);

  return {
    ...user,
    name: override.name?.trim() || user.name,
    avatarUrl: override.avatarUrl ?? user.avatarUrl
  } satisfies AppUser;
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
  const users = demoUsers.map(applyProfileOverride);
  const currentUser = users.find((user) => user.id === userId) ?? users[0];
  return buildWorkspace({
    currentUserId: currentUser.id,
    users,
    chatRecords: demoChats,
    memberIdsByChat: demoMembersByChat,
    messagesByChat: loadDemoMessages(),
    mode: "demo",
    syncLabel: "Р›С‘РіРєРёР№ РѕР·РЅР°РєРѕРјРёС‚РµР»СЊРЅС‹Р№ СЂРµР¶РёРј Nexa.",
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
    throw new Error("Supabase РєР»РёРµРЅС‚ РЅРµ РЅР°СЃС‚СЂРѕРµРЅ.");
  }

  const { fullName, username } = getProfileDefaults(user);
  const storedOverride = getStoredProfileOverride(user.id);
  const defaultAvatarUrl = getProfileAvatarDefault(user);
  const basePayload = {
    id: user.id,
    email: user.email ?? null,
    full_name: fullName,
    username,
    role: "student",
    accent_color: pickAccentColor(user.id),
    bio: "РЈС‡Р°СЃС‚РЅРёРє Nexa С‡РµСЂРµР· GitHub Pages + Supabase."
  };

  let { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        ...basePayload,
        avatar_url: storedOverride.avatarUrl ?? defaultAvatarUrl ?? null
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error && error.message.toLowerCase().includes("avatar_url")) {
    ({ data, error } = await supabase.from("profiles").upsert(basePayload, { onConflict: "id" }).select().single());
  }

  if (error) {
    throw new Error(error.message);
  }

  return mapProfileRow(data as SupabaseProfileRow);
}

async function ensureDefaultMemberships(userId: string) {
  if (!supabase) {
    return;
  }

  const { error: membershipError } = await supabase
    .from("chat_members")
    .upsert([{ chat_id: defaultChatId, user_id: userId }], { onConflict: "chat_id,user_id", ignoreDuplicates: true });

  if (membershipError) {
    throw new Error(membershipError.message);
  }
}

async function ensureDefaultChatRecord() {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("chats").upsert(
    {
      id: defaultFallbackChat.id,
      title: defaultFallbackChat.title,
      kind: defaultFallbackChat.kind,
      description: defaultFallbackChat.description,
      accent_color: defaultFallbackChat.accentColor,
      is_default: true
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function fetchSupabaseDirectoryUsers(currentUserId: string) {
  if (!supabase) {
    return [] as AppUser[];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .neq("id", currentUserId)
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as SupabaseProfileRow[] | null) ?? []).map(mapProfileRow);
}

function buildSupabaseFallbackWorkspace(profile: AppUser, syncLabel: string, directoryUsers: AppUser[] = readCachedDirectoryUsers()) {
  return buildWorkspace({
    currentUserId: profile.id,
    users: mergeUsersById([profile], directoryUsers.filter((entry) => entry.id !== profile.id)),
    chatRecords: [defaultFallbackChat],
    memberIdsByChat: {
      [defaultChatId]: [profile.id]
    },
    messagesByChat: {
      [defaultChatId]: []
    },
    mode: "supabase",
    syncLabel,
    universityName
  });
}

async function fetchSupabaseWorkspace(user: SupabaseAuthUser) {
  if (!supabase) {
    throw new Error("\u0421\u043b\u0443\u0436\u0431\u0430 Supabase \u0435\u0449\u0451 \u043d\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0430.");
  }

  let profile = buildAuthFallbackProfile(user);

  try {
    profile = await ensureSupabaseProfile(user);
  } catch (profileError) {
    if (looksLikeSupabaseAccessIssue(profileError)) {
      return buildSupabaseFallbackWorkspace(profile, "");
    }

    throw profileError;
  }

  try {
    await ensureDefaultChatRecord();
    await ensureDefaultMemberships(user.id);
  } catch (membershipError) {
    if (looksLikeSupabaseAccessIssue(membershipError)) {
      return buildSupabaseFallbackWorkspace(
        profile,
        "\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e, \u043d\u043e \u043f\u0440\u0430\u0432\u0438\u043b\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u0430 Supabase \u0435\u0449\u0451 \u043e\u0431\u043d\u043e\u0432\u043b\u044f\u044e\u0442\u0441\u044f. \u0427\u0430\u0442\u044b \u043f\u043e\u044f\u0432\u044f\u0442\u0441\u044f \u043f\u043e\u0441\u043b\u0435 SQL-\u043f\u0430\u0442\u0447\u0430."
      );
    }

    throw membershipError;
  }

  const { data: ownMemberships, error: ownMembershipError } = await supabase
    .from("chat_members")
    .select("chat_id")
    .eq("user_id", user.id);

  if (ownMembershipError) {
    if (looksLikeSupabaseAccessIssue(ownMembershipError)) {
      return buildSupabaseFallbackWorkspace(
        profile,
        "\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e, \u043d\u043e \u043f\u0440\u0430\u0432\u0438\u043b\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u0430 Supabase \u0435\u0449\u0451 \u043e\u0431\u043d\u043e\u0432\u043b\u044f\u044e\u0442\u0441\u044f. \u0427\u0430\u0442\u044b \u043f\u043e\u044f\u0432\u044f\u0442\u0441\u044f \u043f\u043e\u0441\u043b\u0435 SQL-\u043f\u0430\u0442\u0447\u0430."
      );
    }

    throw new Error(ownMembershipError.message);
  }

  const chatIds = (ownMemberships ?? []).map((row) => String(row.chat_id));
  if (!chatIds.length) {
    return buildSupabaseFallbackWorkspace(
      profile,
      "\u0410\u043a\u043a\u0430\u0443\u043d\u0442 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0451\u043d. \u041e\u0431\u0449\u0438\u0439 \u0447\u0430\u0442 \u043f\u043e\u044f\u0432\u0438\u0442\u0441\u044f \u0437\u0434\u0435\u0441\u044c, \u043a\u0430\u043a \u0442\u043e\u043b\u044c\u043a\u043e \u043e\u043d \u0431\u0443\u0434\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d."
    );
  }

  const [{ data: chatRows, error: chatError }, { data: memberRows, error: memberError }, { data: messageRows, error: messageError }] =
    await Promise.all([
      supabase.from("chats").select("*").in("id", chatIds),
      supabase.from("chat_members").select("chat_id,user_id").in("chat_id", chatIds),
      supabase
        .from("messages")
        .select("*")
        .in("chat_id", chatIds)
        .order("created_at", { ascending: false })
        .limit(Math.max(60, chatIds.length * 24))
    ]);

  const workspaceError = chatError ?? memberError ?? messageError;
  if (workspaceError) {
    if (looksLikeSupabaseAccessIssue(workspaceError)) {
      return buildSupabaseFallbackWorkspace(
        profile,
        "\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e, \u043d\u043e \u0434\u043e\u0441\u0442\u0443\u043f \u043a \u0447\u0430\u0442\u0430\u043c \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430\u043c\u0438 Supabase."
      );
    }

    throw new Error(workspaceError.message);
  }

  const memberIds = Array.from(new Set((memberRows ?? []).map((row) => String((row as SupabaseChatMemberRow).user_id))));
  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", memberIds.length ? memberIds : [user.id]);

  if (profileError) {
    if (looksLikeSupabaseAccessIssue(profileError)) {
      return buildSupabaseFallbackWorkspace(
        profile,
        "\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e, \u043d\u043e \u043f\u0440\u043e\u0444\u0438\u043b\u0438 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b\u0438\u0441\u044c \u0438\u0437 Supabase."
      );
    }

    throw new Error(profileError.message);
  }

  const users = ((profileRows as SupabaseProfileRow[] | null) ?? []).map(mapProfileRow);
  if (!users.some((entry) => entry.id === profile.id)) {
    users.unshift(profile);
  }
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
  Object.values(messagesByChat).forEach((messages) => {
    messages.sort((left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime());
  });

  const chatRecords = ((chatRows as SupabaseChatRow[] | null) ?? []).map(mapChatRow);
  if (!chatRecords.some((chat) => chat.id === defaultChatId)) {
    chatRecords.unshift(defaultFallbackChat);
  }
  memberIdsByChat[defaultChatId] = Array.from(new Set([user.id, ...(memberIdsByChat[defaultChatId] ?? [])]));
  messagesByChat[defaultChatId] = messagesByChat[defaultChatId] ?? [];

  return ensureWorkspaceBaseline(
    buildWorkspace({
    currentUserId: user.id,
    users,
    chatRecords,
    memberIdsByChat,
    messagesByChat,
    mode: "supabase",
    syncLabel: "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u0441\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0438\u0440\u0443\u044e\u0442\u0441\u044f \u043c\u0435\u0436\u0434\u0443 \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0430\u043c\u0438.",
    universityName
  }));
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
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(() => loadWorkspaceCache()?.workspace ?? null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(() => loadWorkspaceCache()?.selectedChatId ?? null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorVisible, setErrorVisible] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(() => supabaseEnabled && hasAuthCallbackParams());
  const [, setLoadingStatus] = useState("Подключение к Nexa.");
  const [connectionLabel, setConnectionLabel] = useState<ConnectionLabel>(() =>
    loadWorkspaceCache()?.workspace ? "reconnecting" : "offline"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [directoryUsers, setDirectoryUsers] = useState<AppUser[]>(() => readCachedDirectoryUsers());
  const [directoryResults, setDirectoryResults] = useState<AppUser[]>([]);
  const [isDirectoryLoading, setIsDirectoryLoading] = useState(false);
  const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [profileAvatarDraft, setProfileAvatarDraft] = useState<string | undefined>(undefined);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [rememberedUsers, setRememberedUsers] = useState<RememberedDeviceUser[]>(() => readRememberedUsers());
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const realtimeChannelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceRef = useRef<WorkspaceData | null>(workspace);
  const selectedChatIdRef = useRef<string | null>(selectedChatId);

  const matchesSearch = (query: string, ...values: Array<string | null | undefined>) => {
    if (!query) {
      return true;
    }

    return values.some((value) => value?.toLowerCase().includes(query));
  };

  const activeChat = workspace?.chats.find((chat) => chat.id === selectedChatId) ?? workspace?.chats[0] ?? null;
  const activeMessages = activeChat ? workspace?.messagesByChat[activeChat.id] ?? [] : [];
  const usersById = useMemo(() => new Map((workspace?.users ?? []).map((user) => [user.id, user])), [workspace?.users]);
  const searchValue = searchQuery.trim().toLowerCase();

  const directorySource = useMemo(() => {
    if (!workspace) {
      return [] as AppUser[];
    }

    return mergeUsersById(directoryUsers, workspace.users, rememberedUsers.map(mapRememberedUserToAppUser)).filter(
      (user) => user.id !== workspace.currentUser.id
    );
  }, [directoryUsers, rememberedUsers, workspace]);

  const localDirectoryMatches = useMemo(() => {
    if (!searchValue) {
      return [] as AppUser[];
    }

    return directorySource.filter((user) => {
      return matchesSearch(searchValue, user.name, user.username, user.bio, user.email);
    });
  }, [directorySource, searchValue]);

  const visibleUsers = useMemo(() => {
    if (!searchValue) {
      return directorySource.slice(0, 18);
    }

    return directoryResults;
  }, [directoryResults, directorySource, searchValue]);

  const visibleChats = useMemo(() => {
    if (!workspace) {
      return [] as ChatSummary[];
    }

    if (!searchValue) {
      return workspace.chats;
    }

    return workspace.chats.filter((chat) =>
      matchesSearch(searchValue, chat.title, chat.description, chat.lastMessagePreview)
    );
  }, [workspace, searchValue]);

  const activeChatMembers = useMemo(() => {
    if (!activeChat) {
      return [] as AppUser[];
    }

    return activeChat.memberIds.map((memberId) => usersById.get(memberId)).filter(Boolean) as AppUser[];
  }, [activeChat, usersById]);

  const activeChatSubtitle = useMemo(() => {
    if (!activeChat) {
      return "";
    }

    if (activeChat.kind === "direct") {
      return activeChat.description || "Личный чат";
    }

    if (activeChat.description) {
      return activeChat.description;
    }

    return `${activeChatMembers.length} участников`;
  }, [activeChat, activeChatMembers]);

  const backgroundActivity = Boolean(isBusy || isDirectoryLoading || connectionLabel === "reconnecting");

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    if (!workspace || workspace.mode !== "supabase") {
      return;
    }

    setWorkspace((current) => (current ? ensureWorkspaceBaseline(current) : current));
  }, [workspace?.currentUser.id, workspace?.mode]);

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  useEffect(() => {
    saveDemoSessionUserId(null);
  }, []);

  useEffect(() => {
    if (!workspace) {
      setProfileNameDraft("");
      setProfileAvatarDraft(undefined);
      setIsProfilePanelOpen(false);
      return;
    }

    setProfileNameDraft(workspace.currentUser.name);
    setProfileAvatarDraft(workspace.currentUser.avatarUrl);
  }, [workspace]);

  useEffect(() => {
    if (!workspace || workspace.mode !== "supabase") {
      return;
    }

    setRememberedUsers(rememberDeviceUser(workspace.currentUser));
  }, [
    workspace?.mode,
    workspace?.currentUser.id,
    workspace?.currentUser.name,
    workspace?.currentUser.username,
    workspace?.currentUser.avatarUrl,
    workspace?.currentUser.role,
    workspace?.currentUser.accentColor
  ]);

  useEffect(() => {
    if (!workspace || workspace.mode !== "supabase") {
      setDirectoryUsers(readCachedDirectoryUsers());
      return;
    }

    if (!supabase || !hasActiveSession) {
      setDirectoryUsers((current) => (current.length ? current : readCachedDirectoryUsers()));
      return;
    }

    const client = supabase;
    const currentUserId = workspace.currentUser.id;
    let ignore = false;

    async function refreshDirectory() {
      try {
        const { data, error: profilesError } = await client
          .from("profiles")
          .select("*")
          .neq("id", currentUserId)
          .order("full_name", { ascending: true });

        if (ignore || profilesError) {
          if (profilesError) {
            throw profilesError;
          }
          return;
        }

        const nextUsers = ((data as SupabaseProfileRow[] | null) ?? []).map(mapProfileRow);
        setDirectoryUsers(nextUsers);
        saveCachedDirectoryUsers(nextUsers);
        setWorkspace((current) => (current ? mergeWorkspaceUsers(current, nextUsers) : current));
      } catch {
        if (!ignore) {
          setDirectoryUsers((current) => (current.length ? current : readCachedDirectoryUsers()));
        }
      }
    }

    void refreshDirectory();
    const interval = window.setInterval(() => {
      void refreshDirectory();
    }, 12000);

    const channel = client
      .channel(`nexa-profiles-${workspace.currentUser.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        void refreshDirectory();
      })
      .subscribe();

    return () => {
      ignore = true;
      window.clearInterval(interval);
      channel.unsubscribe();
    };
  }, [workspace?.currentUser.id, workspace?.mode, hasActiveSession]);

  useEffect(() => {
    if (!workspace || workspace.mode !== "supabase" || !supabase || !hasActiveSession) {
      return;
    }

    const client = supabase;
    let ignore = false;

    async function syncPresence() {
      try {
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError || !data.session?.user || ignore) {
          return;
        }

        const syncedProfile = await ensureSupabaseProfile(data.session.user);
        if (ignore) {
          return;
        }

        await ensureDefaultChatRecord();
        await ensureDefaultMemberships(data.session.user.id);
        if (ignore) {
          return;
        }

        setWorkspace((current) => {
          if (!current) {
            return ensureWorkspaceBaseline(buildSupabaseFallbackWorkspace(syncedProfile, "", readCachedDirectoryUsers()));
          }

          return ensureWorkspaceBaseline(mergeWorkspaceUsers(current, [syncedProfile]));
        });
      } catch {
        // Keep the local workspace responsive even if background sync fails.
      }
    }

    void syncPresence();
    const interval = window.setInterval(() => {
      void syncPresence();
    }, 20000);

    return () => {
      ignore = true;
      window.clearInterval(interval);
    };
  }, [workspace?.currentUser.id, workspace?.mode, hasActiveSession]);

  useEffect(() => {
    if (!workspace || workspace.mode !== "supabase") {
      return;
    }

    const timer = window.setTimeout(() => {
      saveWorkspaceCache(workspace, selectedChatId);
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [workspace, selectedChatId]);

  useEffect(() => {
    const callbackMessage = readAuthCallbackMessage();
    if (!callbackMessage) {
      return;
    }

    setError(callbackMessage);
    clearAuthCallbackUrl();
  }, []);

  useEffect(() => {
    if (!error) {
      setErrorVisible(false);
      return;
    }

    setErrorVisible(true);

    const hideTimer = window.setTimeout(() => {
      setErrorVisible(false);
    }, 10000);

    const clearTimer = window.setTimeout(() => {
      setError((current) => (current === error ? null : current));
    }, 10600);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(clearTimer);
    };
  }, [error]);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    if (selectedChatId && workspace.chats.some((chat) => chat.id === selectedChatId)) {
      return;
    }

    setSelectedChatId(workspace.chats[0]?.id ?? null);
  }, [workspace, selectedChatId]);

  useEffect(() => {
    if (!workspace) {
      setDirectoryResults([]);
      setIsDirectoryLoading(false);
      return;
    }

    if (!searchValue) {
      setDirectoryResults(directorySource.slice(0, 18));
      setIsDirectoryLoading(false);
      return;
    }

    if (workspace.mode !== "supabase" || !supabase) {
      setDirectoryResults(localDirectoryMatches);
      setIsDirectoryLoading(false);
      return;
    }

    let ignore = false;
    setDirectoryResults(localDirectoryMatches);
    setIsDirectoryLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const sanitized = searchValue.replace(/[%_]/g, "").replace(/^@+/, "").trim();
        if (!sanitized) {
          if (!ignore) {
            setDirectoryResults(directorySource.slice(0, 18));
            setIsDirectoryLoading(false);
          }
          return;
        }

        const pattern = `%${sanitized}%`;
        const client = supabase;
        if (!client) {
          return;
        }

        const { data, error: searchError } = await client
          .from("profiles")
          .select("*")
          .neq("id", workspace.currentUser.id)
          .or(`full_name.ilike.${pattern},username.ilike.${pattern},bio.ilike.${pattern},email.ilike.${pattern}`)
          .limit(48);

        if (ignore) {
          return;
        }

        if (searchError) {
          throw searchError;
        }

        const merged = new Map(localDirectoryMatches.map((user) => [user.id, user]));
        for (const row of ((data as SupabaseProfileRow[] | null) ?? [])) {
          const user = mapProfileRow(row);
          merged.set(user.id, user);
        }

        const mergedUsers = Array.from(merged.values()).slice(0, 48);
        setDirectoryResults(mergedUsers);
        setDirectoryUsers((current) => {
          const nextUsers = mergeUsersById(current, mergedUsers);
          saveCachedDirectoryUsers(nextUsers);
          return nextUsers;
        });
      } catch {
        if (!ignore) {
          setDirectoryResults(localDirectoryMatches);
        }
      } finally {
        if (!ignore) {
          setIsDirectoryLoading(false);
        }
      }
    }, 140);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [workspace, searchValue, localDirectoryMatches, directorySource]);

  useEffect(() => {
    if (!supabaseEnabled || !supabase) {
      setIsLoading(false);
      return;
    }

    const client = supabase;
    const isAuthCallback = hasAuthCallbackParams();
    let ignore = false;
    let callbackResolved = !isAuthCallback;

    if (isAuthCallback) {
      setIsLoading(true);
      setError(null);
      setLoadingStatus("Завершение входа.");
    }

    async function hydrateWorkspace(
      session: { user: SupabaseAuthUser },
      options: { showLoader: boolean; fallback: string; silent: boolean }
    ) {
      const { showLoader, fallback, silent } = options;

      try {
        if (showLoader) {
          setIsLoading(true);
          setLoadingStatus("Загрузка данных Nexa.");
        }

        const nextWorkspace = await withTimeout(
          fetchSupabaseWorkspace(session.user),
          showLoader ? 30000 : 20000,
          "Подключение к Supabase заняло слишком много времени."
        );

        if (ignore) {
          return;
        }

        setWorkspace(ensureWorkspaceBaseline(nextWorkspace));
        setSelectedChatId((current) =>
          current && nextWorkspace.chats.some((chat) => chat.id === current)
            ? current
            : nextWorkspace.chats[0]?.id ?? null
        );
        setHasActiveSession(true);
        setConnectionLabel("live");
        setNotice(null);
        setError(null);
      } catch (loadError) {
        if (!ignore) {
          const fallbackProfile = buildAuthFallbackProfile(session.user);
          let fallbackDirectory = readCachedDirectoryUsers();

          try {
            fallbackDirectory = await fetchSupabaseDirectoryUsers(session.user.id);
            saveCachedDirectoryUsers(fallbackDirectory);
            setDirectoryUsers(fallbackDirectory);
          } catch {
            setDirectoryUsers((current) => (current.length ? current : fallbackDirectory));
          }

          const fallbackWorkspace = ensureWorkspaceBaseline(buildSupabaseFallbackWorkspace(fallbackProfile, "", fallbackDirectory));
          setWorkspace((current) => current ? ensureWorkspaceBaseline(current) : fallbackWorkspace);
          setSelectedChatId((current) => current ?? fallbackWorkspace.chats[0]?.id ?? null);
          setHasActiveSession(true);
          setConnectionLabel("reconnecting");
          setError(null);
        }
      } finally {
        if (!ignore) {
          callbackResolved = true;
          if (isAuthCallback) {
            clearAuthCallbackUrl();
          }
          setIsLoading(false);
        }
      }
    }

    async function bootstrapSession() {
      try {
        const { data, error: sessionError } = await withTimeout(
          client.auth.getSession(),
          isAuthCallback ? 16000 : 7000,
          isAuthCallback ? "Не удалось завершить вход." : "Не удалось быстро восстановить вход."
        );
        if (ignore) {
          return;
        }

        if (sessionError) {
          throw sessionError;
        }

        if (!data.session?.user) {
          callbackResolved = true;
          setHasActiveSession(false);
          setIsLoading(false);
          if (isAuthCallback) {
            clearAuthCallbackUrl();
            setError("Не удалось завершить вход.");
          }
          return;
        }

        callbackResolved = true;
        await hydrateWorkspace(data.session, {
          showLoader: isAuthCallback,
          fallback: isAuthCallback ? "Не удалось завершить вход." : "Не удалось восстановить вход.",
          silent: !isAuthCallback
        });
      } catch (sessionError) {
        if (ignore) {
          return;
        }

        callbackResolved = true;
        setHasActiveSession(false);
        if (workspaceRef.current?.mode === "supabase") {
          setConnectionLabel("offline");
        }
        setIsLoading(false);
        if (isAuthCallback) {
          clearAuthCallbackUrl();
          setError(formatUiErrorMessage(sessionError, "Не удалось завершить вход."));
        }
      }
    }

    const callbackTimer = isAuthCallback
      ? window.setTimeout(() => {
          if (!ignore && !callbackResolved) {
            clearAuthCallbackUrl();
            setIsLoading(false);
            setError("Не удалось завершить вход.");
          }
        }, 30000)
      : null;

    void bootstrapSession();

    const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
      if (ignore) {
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        setHasActiveSession(Boolean(session?.user));
        setConnectionLabel("live");
      }

      if (!session?.user) {
        setHasActiveSession(false);
        setConnectionLabel("offline");
        setIsLoading(false);

        if (!workspaceRef.current || workspaceRef.current.mode !== "supabase") {
          setWorkspace(null);
          setSelectedChatId(null);
        }

        return;
      }

      window.setTimeout(() => {
        if (ignore) {
          return;
        }

        void hydrateWorkspace(session, {
          showLoader: false,
          fallback: event === "SIGNED_IN" ? "Не удалось завершить вход." : "Не удалось восстановить вход.",
          silent: false
        });
      }, 0);
    });

    return () => {
      ignore = true;
      if (callbackTimer) {
        window.clearTimeout(callbackTimer);
      }
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!workspace || workspace.mode !== "supabase" || !supabase || !hasActiveSession) {
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
  }, [workspace, usersById, hasActiveSession]);

  useEffect(() => {
    if (!workspace || workspace.mode !== "supabase" || !supabase || !hasActiveSession) {
      return;
    }

    const client = supabase;
    const channel = client
      .channel(`nexa-chat-members-${workspace.currentUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_members",
          filter: `user_id=eq.${workspace.currentUser.id}`
        },
        () => {
          void refreshWorkspaceFromSession(selectedChatIdRef.current ?? undefined).catch(() => undefined);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [workspace?.currentUser.id, workspace?.mode, hasActiveSession]);

  async function refreshWorkspaceFromSession(preferredChatId?: string) {
    if (!supabase) {
      throw new Error("Служба Supabase ещё не подключена.");
    }

    const { data: authData, error: authError } = await withTimeout(
      supabase.auth.getSession(),
      8000,
      "Не удалось быстро восстановить вход."
    );
    if (authError) {
      throw new Error(authError.message);
    }

    if (!authData.session?.user) {
      throw new Error("Auth session missing");
    }

    const nextWorkspace = await withTimeout(
      fetchSupabaseWorkspace(authData.session.user),
      25000,
      "Подключение к Supabase заняло слишком много времени."
    );

    setWorkspace(ensureWorkspaceBaseline(nextWorkspace));
    setSelectedChatId(
      preferredChatId && nextWorkspace.chats.some((chat) => chat.id === preferredChatId)
        ? preferredChatId
        : nextWorkspace.chats[0]?.id ?? null
    );
    setHasActiveSession(true);
    setConnectionLabel("live");
    setError(null);
  }

  async function handleProviderLogin(providerId: string, label: string) {
    if (!supabase) {
      setError("Сайт ещё не подключён к Supabase.");
      return;
    }

    setIsBusy(true);
    setIsLoading(true);
    setLoadingStatus(`Открытие входа через ${label}.`);
    setError(null);
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: providerId as never,
        options: {
          redirectTo,
          scopes: "openid profile"
        }
      });

      if (oauthError) {
        throw oauthError;
      }
    } catch (oauthError) {
      setError(formatUiErrorMessage(oauthError, `${label}-вход временно недоступен.`));
      setIsLoading(false);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleTelegramLogin() {
    await handleProviderLogin(telegramProviderId, "Telegram");
  }

  async function handleOpenProfileChat(target: AppUser) {
    if (!workspace) {
      return;
    }

    const existingDirectChat = workspace.chats.find(
      (chat) =>
        chat.kind === "direct" &&
        chat.memberIds.length === 2 &&
        chat.memberIds.includes(workspace.currentUser.id) &&
        chat.memberIds.includes(target.id)
    );

    if (existingDirectChat) {
      setSelectedChatId(existingDirectChat.id);
      setSearchQuery("");
      return;
    }

    if (workspace.mode !== "supabase" || !supabase) {
      setError("Поиск пользователей доступен после подключения к Supabase.");
      return;
    }

    if (!hasActiveSession) {
      setError("Вход нужно обновить.");
      return;
    }

    setIsBusy(true);
    setLoadingStatus("Подготовка диалога.");
    setNotice(null);
    setError(null);

    try {
      const directChatId = buildDirectChatId(workspace.currentUser.id, target.id);
      setDirectoryUsers((current) => {
        const nextUsers = mergeUsersById(current, [target]);
        saveCachedDirectoryUsers(nextUsers);
        return nextUsers;
      });
      setWorkspace((current) => (current ? upsertLocalDirectChat(current, target, directChatId) : current));
      setSelectedChatId(directChatId);
      setSearchQuery("");
      setDirectoryResults([]);

      const { error: createChatError } = await supabase.from("chats").upsert(
        {
          id: directChatId,
          title: "Диалог",
          kind: "direct",
          description: "",
          accent_color: target.accentColor,
          is_default: false
        },
        { onConflict: "id", ignoreDuplicates: true }
      );

      if (createChatError) {
        throw new Error(createChatError.message);
      }

      const { error: membershipInsertError } = await supabase
        .from("chat_members")
        .upsert(
          [
            { chat_id: directChatId, user_id: workspace.currentUser.id },
            { chat_id: directChatId, user_id: target.id }
          ],
          { onConflict: "chat_id,user_id", ignoreDuplicates: true }
        );

      if (membershipInsertError) {
        throw new Error(membershipInsertError.message);
      }

      try {
        await refreshWorkspaceFromSession(directChatId);
      } catch (refreshError) {
        if (!looksLikeSupabaseAccessIssue(refreshError)) {
          throw refreshError;
        }

        setConnectionLabel("reconnecting");
      }
    } catch (openError) {
      setError(formatUiErrorMessage(openError, "Не удалось открыть диалог."));
    } finally {
      setIsBusy(false);
      setIsLoading(false);
    }
  }

  function applyCurrentUserProfile(nextName: string, nextAvatarUrl?: string) {
    setWorkspace((current) => {
      if (!current) {
        return current;
      }

      const nextUsers = current.users.map((user) =>
        user.id === current.currentUser.id
          ? {
              ...user,
              name: nextName,
              avatarUrl: nextAvatarUrl
            }
          : user
      );

      return buildWorkspace({
        currentUserId: current.currentUser.id,
        users: nextUsers,
        chatRecords: current.chatRecords,
        memberIdsByChat: current.memberIdsByChat,
        messagesByChat: current.messagesByChat,
        mode: current.mode,
        syncLabel: current.syncLabel,
        universityName: current.universityName
      });
    });
  }

  function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Подходит только изображение.");
      return;
    }

    if (file.size > 1_500_000) {
      setError("Аватарка слишком тяжёлая. Лучше выбрать изображение до 1.5 МБ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : undefined;
      if (!result) {
        setError("Не удалось прочитать изображение.");
        return;
      }

      setProfileAvatarDraft(result);
      setError(null);
    };
    reader.onerror = () => {
      setError("Не удалось прочитать изображение.");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  async function handleSaveProfile() {
    if (!workspace) {
      return;
    }

    const nextName = profileNameDraft.trim();
    if (!nextName) {
      setError("Имя не должно быть пустым.");
      return;
    }

    setIsProfileSaving(true);
    setError(null);

    try {
      if (workspace.mode === "supabase" && supabase && hasActiveSession) {
        const payload = {
          full_name: nextName,
          avatar_url: profileAvatarDraft ?? null
        };

        const { error: updateError } = await supabase
          .from("profiles")
          .update(payload)
          .eq("id", workspace.currentUser.id);

        if (updateError) {
          const normalized = updateError.message.toLowerCase();
          if (normalized.includes("avatar_url")) {
            const { error: fallbackError } = await supabase
              .from("profiles")
              .update({ full_name: nextName })
              .eq("id", workspace.currentUser.id);

            if (fallbackError) {
              throw fallbackError;
            }
          } else {
            throw updateError;
          }
        }
      }

      saveProfileOverride(workspace.currentUser.id, {
        name: nextName,
        avatarUrl: profileAvatarDraft
      });
      applyCurrentUserProfile(nextName, profileAvatarDraft);
      setIsProfilePanelOpen(false);
    } catch (profileError) {
      setError(formatUiErrorMessage(profileError, "Профиль не сохранился."));
    } finally {
      setIsProfileSaving(false);
    }
  }

  async function handleLogout() {
    if (workspace?.mode === "supabase" && supabase) {
      await supabase.auth.signOut();
    }

    saveDemoSessionUserId(null);
    clearWorkspaceCache();

    setWorkspace(null);
    setSelectedChatId(null);
    setDraft("");
    setSearchQuery("");
    setDirectoryResults([]);
    setNotice(null);
    setHasActiveSession(false);
    setConnectionLabel("offline");
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
        return message;
      }

      if (!supabase) {
        throw new Error("Supabase не подключён.");
      }

      if (!hasActiveSession) {
        throw new Error("Auth session missing");
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
      setError(formatUiErrorMessage(sendError, "Сообщение не отправилось."));
    } finally {
      setIsBusy(false);
    }
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
            <p>Вход в Nexa выполняется через Telegram.</p>
          </div>

          <div className="auth-form auth-single-flow">
            <button type="button" className="telegram-button" onClick={handleTelegramLogin} disabled={isBusy || isLoading}>
              {isBusy || isLoading ? "Подключение..." : "Войти через Telegram"}
            </button>
          </div>

          {rememberedUsers.length ? (
            <div className="remembered-panel">
              <div className="remembered-panel-head">
                <span className="section-label">На этом устройстве</span>
                <span className="remembered-hint">Последние профили</span>
              </div>
              <div className="remembered-list">
                {rememberedUsers.map((user) => (
                  <div key={user.id} className="remembered-card">
                    {renderAvatar({
                      label: user.name,
                      accentColor: user.accentColor,
                      imageUrl: user.avatarUrl,
                      className: "remembered-avatar"
                    })}
                    <span className="remembered-copy">
                      <strong>{user.name}</strong>
                      <span>@{user.username}</span>
                    </span>
                    <small>{formatRememberedStamp(user.lastSeenAt)}</small>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {notice ? <p className="notice-text">{notice}</p> : null}
          {error ? <p className={`error-text${errorVisible ? " is-visible" : ""}`}>{error}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="workspace-shell">
      <aside className="workspace-nav">
        <button type="button" className="nav-icon-button nav-brand" aria-label="Nexa">
          <img className="nav-brand-logo" src={brandLogoUrl} alt="Nexa" />
        </button>

        <div className="workspace-nav-group">
          <button type="button" className="nav-icon-button is-active" aria-label="Чаты">
            <span>≡</span>
            <small>Чаты</small>
          </button>
          <button
            type="button"
            className={`nav-icon-button ${searchValue ? "is-active" : ""}`}
            aria-label="Поиск пользователей"
            onClick={() => window.document.getElementById("nexa-search")?.focus()}
          >
            <span>⌕</span>
            <small>Поиск</small>
          </button>
        </div>

        <div className="workspace-nav-bottom">
          <button
            type="button"
            className={`nav-profile-trigger ${isProfilePanelOpen ? "is-open" : ""}`}
            aria-label="Профиль"
            aria-expanded={isProfilePanelOpen}
            aria-controls="nexa-profile-drawer"
            onClick={() => setIsProfilePanelOpen((current) => !current)}
          >
            {renderAvatar({
              label: workspace.currentUser.name,
              accentColor: workspace.currentUser.accentColor,
              imageUrl: workspace.currentUser.avatarUrl,
              className: "nav-profile-avatar"
            })}
            <small>Профиль</small>
          </button>
        </div>
      </aside>

      {isProfilePanelOpen ? (
        <button type="button" className="profile-drawer-backdrop" aria-label="Закрыть профиль" onClick={() => setIsProfilePanelOpen(false)} />
      ) : null}

      <aside id="nexa-profile-drawer" className={`profile-drawer ${isProfilePanelOpen ? "is-open" : ""}`}>
        <div className="profile-drawer-head">
          {renderAvatar({
            label: profileNameDraft || workspace.currentUser.name,
            accentColor: workspace.currentUser.accentColor,
            imageUrl: profileAvatarDraft,
            className: "profile-drawer-avatar"
          })}
          <div className="profile-drawer-copy">
            <strong>{workspace.currentUser.username ? `@${workspace.currentUser.username}` : "Nexa"}</strong>
            <span>{workspace.currentUser.role === "curator" ? "Куратор" : "Участник Nexa"}</span>
          </div>
          <button type="button" className="profile-drawer-close" aria-label="Закрыть" onClick={() => setIsProfilePanelOpen(false)}>
            ×
          </button>
        </div>

        <label className="profile-field">
          <span>Имя</span>
          <input
            type="text"
            value={profileNameDraft}
            onChange={(event) => setProfileNameDraft(event.target.value.slice(0, 48))}
            placeholder="Имя в Nexa"
          />
        </label>

        <div className="profile-field">
          <span>Аватарка</span>
          <div className="profile-action-row">
            <input ref={avatarInputRef} className="hidden-file-input" type="file" accept="image/*" onChange={handleAvatarFileChange} />
            <button type="button" className="profile-secondary-button" onClick={() => avatarInputRef.current?.click()}>
              Выбрать фото
            </button>
            {profileAvatarDraft ? (
              <button type="button" className="profile-secondary-button is-muted" onClick={() => setProfileAvatarDraft(undefined)}>
                Убрать
              </button>
            ) : null}
          </div>
        </div>

        <div className="profile-drawer-footer">
          {!hasActiveSession && workspace.mode === "supabase" ? (
            <button type="button" className="profile-secondary-button" onClick={() => void handleTelegramLogin()}>
              Обновить вход
            </button>
          ) : null}
          <button type="button" className="profile-primary-button" onClick={() => void handleSaveProfile()} disabled={isProfileSaving}>
            {isProfileSaving ? "Сохранение..." : "Сохранить"}
          </button>
          <button type="button" className="profile-secondary-button is-danger" onClick={() => void handleLogout()}>
            Выйти
          </button>
        </div>
      </aside>

      <aside className="workspace-sidebar">
        <div className="sidebar-searchbar">
          <input
            id="nexa-search"
            className="sidebar-search-input"
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Поиск"
            autoComplete="off"
          />
          {renderAvatar({
            label: workspace.currentUser.name,
            accentColor: workspace.currentUser.accentColor,
            imageUrl: workspace.currentUser.avatarUrl,
            className: "sidebar-search-avatar"
          })}
        </div>

        <div className="thread-list">
          {searchValue ? (
            <>
              <section className="sidebar-section">
                <div className="section-label-row">
                  <span className="section-label">Люди</span>
                  {isDirectoryLoading ? (
                    <span className="mini-loader" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : null}
                </div>
                {visibleUsers.length ? (
                  visibleUsers.map((user) => (
                    <button type="button" key={user.id} className="directory-row" onClick={() => void handleOpenProfileChat(user)}>
                      {renderAvatar({
                        label: user.name,
                        accentColor: user.accentColor,
                        imageUrl: user.avatarUrl
                      })}
                      <span className="directory-copy">
                        <strong>{user.name}</strong>
                        <span>@{user.username}</span>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="empty-search">Совпадений среди зарегистрированных пользователей пока нет.</p>
                )}
              </section>

              <section className="sidebar-section">
                <span className="section-label">Чаты</span>
                {visibleChats.length ? (
                  visibleChats.map((chat) => (
                    <button
                      type="button"
                      key={chat.id}
                      className={`thread-row ${activeChat?.id === chat.id ? "is-active" : ""}`}
                      onClick={() => {
                        setSelectedChatId(chat.id);
                        setSearchQuery("");
                      }}
                    >
                      {renderAvatar({
                        label: chat.title,
                        accentColor: chat.accentColor
                      })}
                      <span className="thread-copy">
                        <span className="thread-copy-head">
                          <strong>{chat.title}</strong>
                          <span>{formatChatStamp(chat.lastMessageAt)}</span>
                        </span>
                        <span className="thread-preview">{chat.lastMessagePreview}</span>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="empty-search">Подходящих чатов по этому запросу пока нет.</p>
                )}
              </section>
            </>
          ) : visibleChats.length ? (
            visibleChats.map((chat) => (
              <button type="button" key={chat.id} className={`thread-row ${activeChat?.id === chat.id ? "is-active" : ""}`} onClick={() => setSelectedChatId(chat.id)}>
                {renderAvatar({
                  label: chat.title,
                  accentColor: chat.accentColor
                })}
                <span className="thread-copy">
                  <span className="thread-copy-head">
                    <strong>{chat.title}</strong>
                    <span>{formatChatStamp(chat.lastMessageAt)}</span>
                  </span>
                  <span className="thread-preview">{chat.lastMessagePreview}</span>
                </span>
              </button>
            ))
          ) : (
            <div className="sidebar-empty-note">
              <span className="section-label">Чаты</span>
              <p>Найдите зарегистрированного пользователя через поиск сверху и откройте первый диалог.</p>
            </div>
          )}
        </div>
      </aside>

      <main className="workspace-main">
        {activeChat ? (
          <>
            <header className="conversation-header">
              <div className="conversation-head-main">
                {renderAvatar({
                  label: activeChat.title,
                  accentColor: activeChat.accentColor,
                  className: "large"
                })}
                <div className="conversation-head-copy">
                  <h2>{activeChat.title}</h2>
                  <p>{activeChatSubtitle}</p>
                </div>
              </div>

              {backgroundActivity ? (
                <div className="background-loader" aria-label="Загрузка в фоне">
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}
            </header>

            <div className="conversation-scroll">
              {activeMessages.map((message) => {
                const author = usersById.get(message.authorId);
                const isOwnMessage = message.authorId === workspace.currentUser.id;

                return (
                  <article key={message.id} className={`message-bubble ${isOwnMessage ? "own" : ""}`}>
                    {!isOwnMessage ? <span className="message-author" style={{ color: author?.accentColor }}>{author?.name ?? "Участник Nexa"}</span> : null}
                    <p>{message.text}</p>
                    <span className="message-time">{formatTime(message.sentAt)}</span>
                  </article>
                );
              })}
            </div>

            <footer className="composer-shell">
              <div className="composer-field-shell">
                <textarea
                  className="composer-input-dark"
                  placeholder="Сообщение"
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value.slice(0, maxMessageLength));
                    if (error) {
                      setError(null);
                    }
                  }}
                  rows={1}
                />
                <span className="char-counter">{draft.length}/{maxMessageLength}</span>
              </div>
              <button type="button" className="send-button" onClick={handleSendMessage} disabled={isBusy || !draft.trim()}>
                Отправить
              </button>
            </footer>
          </>
        ) : (
          <div className="conversation-empty">
            <span className="conversation-empty-chip">Выберите, кому хотелось бы написать</span>
          </div>
        )}

        {notice ? <div className="workspace-toast toast-notice">{notice}</div> : null}
        {error ? <div className={`workspace-toast toast-error${errorVisible ? " is-visible" : ""}`}>{error}</div> : null}
      </main>
    </div>
  );
}

export default App;


