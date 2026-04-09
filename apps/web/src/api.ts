import type { AuthProvidersResponse, BootstrapPayload, Message, User } from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

function normalizeErrorMessage(payload: unknown): string | null {
  if (!payload) {
    return null;
  }

  if (typeof payload === "string") {
    return payload;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const message = normalizeErrorMessage(item);
      if (message) {
        return message;
      }
    }
    return null;
  }

  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (record.code === "too_big") {
      return "Сообщение слишком длинное. Максимум 1500 символов.";
    }

    const directMessage = normalizeErrorMessage(record.message);
    if (directMessage) {
      return directMessage;
    }

    const issueMessage = normalizeErrorMessage(record.error);
    if (issueMessage) {
      return issueMessage;
    }
  }

  return null;
}

async function requestJson<T>(path: string, init?: RequestInit, token?: string) {
  const headers = new Headers(init?.headers ?? {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    let message = `Ошибка запроса (${response.status}).`;
    try {
      const payload = (await response.json()) as unknown;
      const normalizedMessage = normalizeErrorMessage(payload);
      if (normalizedMessage) {
        message = normalizedMessage;
      }
    } catch {
      // Keep the generic error if the response has no JSON payload.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export const api = {
  baseUrl: API_BASE,
  getProviders() {
    return requestJson<AuthProvidersResponse>("/api/auth/providers");
  },
  getDevUsers() {
    return requestJson<{ users: User[] }>("/api/auth/dev-users");
  },
  async devLogin(userId: string) {
    return requestJson<{ token: string; provider: string }>(
      "/api/auth/dev-login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ userId })
      }
    );
  },
  async beginTelegramLogin() {
    return requestJson<{ url: string }>("/api/auth/telegram/start");
  },
  getBootstrap(token: string) {
    return requestJson<BootstrapPayload>("/api/bootstrap", undefined, token);
  },
  sendMessage(token: string, chatId: string, text: string) {
    return requestJson<{ message: Message }>(
      `/api/chats/${chatId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      },
      token
    );
  }
};
