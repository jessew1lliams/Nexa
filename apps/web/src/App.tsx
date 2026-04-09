import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { api } from "./api";
import type { AuthProvidersResponse, BootstrapPayload, ChatSummary, Message, User } from "./types";

const authStorageKey = "nexa-auth-token";
const maxMessageLength = 1500;
const connectionCopy = {
  live: "онлайн",
  reconnecting: "переподключение",
  offline: "офлайн"
} as const;
const chatKindCopy: Record<ChatSummary["kind"], string> = {
  group: "группа",
  direct: "личный чат",
  channel: "канал"
};
const roleCopy: Record<User["role"], string> = {
  student: "студент",
  curator: "куратор",
  teacher: "преподаватель"
};

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

function sortChats(chats: ChatSummary[]) {
  return [...chats].sort((left, right) => {
    const leftTime = left.lastMessageAt ? new Date(left.lastMessageAt).getTime() : 0;
    const rightTime = right.lastMessageAt ? new Date(right.lastMessageAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

function buildPreview(users: User[], currentUserId: string, message: Message) {
  if (message.authorId === currentUserId) {
    return `Вы: ${message.text}`;
  }

  const author = users.find((user) => user.id === message.authorId);
  const authorName = author?.name.split(" ")[0] ?? "Кто-то";
  return `${authorName}: ${message.text}`;
}

function applyIncomingMessage(payload: BootstrapPayload, message: Message) {
  const currentMessages = payload.messagesByChat[message.chatId] ?? [];
  if (currentMessages.some((entry) => entry.id === message.id)) {
    return payload;
  }

  const nextMessagesByChat = {
    ...payload.messagesByChat,
    [message.chatId]: [...currentMessages, message]
  };

  const nextChats = sortChats(
    payload.chats.map((chat) =>
      chat.id === message.chatId
        ? {
            ...chat,
            lastMessagePreview: buildPreview(payload.users, payload.currentUser.id, message),
            lastMessageAt: message.sentAt
          }
        : chat
    )
  );

  return {
    ...payload,
    chats: nextChats,
    messagesByChat: nextMessagesByChat
  };
}

function App() {
  const [providers, setProviders] = useState<AuthProvidersResponse | null>(null);
  const [devUsers, setDevUsers] = useState<User[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem(authStorageKey));
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionLabel, setConnectionLabel] = useState<keyof typeof connectionCopy>("offline");
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.pathname !== "/auth/telegram/callback") {
      return;
    }

    const token = url.searchParams.get("token");
    const callbackError = url.searchParams.get("error");

    if (token) {
      localStorage.setItem(authStorageKey, token);
      setAuthToken(token);
      setError(null);
    } else if (callbackError) {
      setError("Вход через Telegram не завершился. Проверь настройки бота и адрес возврата.");
    }

    window.history.replaceState({}, document.title, "/");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAuthOptions() {
      try {
        const [providersResponse, usersResponse] = await Promise.all([api.getProviders(), api.getDevUsers()]);
        if (cancelled) {
          return;
        }

        setProviders(providersResponse);
        setDevUsers(usersResponse.users);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить настройки.");
        }
      }
    }

    loadAuthOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBootstrap() {
      if (!authToken) {
        setBootstrap(null);
        setSelectedChatId(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const payload = await api.getBootstrap(authToken);
        if (cancelled) {
          return;
        }

        setBootstrap(payload);
        setSelectedChatId((currentId) => currentId ?? payload.chats[0]?.id ?? null);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        localStorage.removeItem(authStorageKey);
        setAuthToken(null);
        setBootstrap(null);
        setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить данные Nexa.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadBootstrap();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (!authToken) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnectionLabel("offline");
      return;
    }

    const socket = io(api.baseUrl, {
      auth: {
        token: authToken
      }
    });

    socket.on("connect", () => {
      setConnectionLabel("live");
    });

    socket.on("disconnect", () => {
      setConnectionLabel("reconnecting");
    });

    socket.on("connect_error", () => {
      setConnectionLabel("offline");
    });

    socket.on("message:created", (event: { chatId: string; message: Message }) => {
      setBootstrap((currentPayload) => {
        if (!currentPayload) {
          return currentPayload;
        }

        return applyIncomingMessage(currentPayload, event.message);
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authToken]);

  const activeChat = bootstrap?.chats.find((chat) => chat.id === selectedChatId) ?? bootstrap?.chats[0] ?? null;
  const activeMessages = activeChat ? bootstrap?.messagesByChat[activeChat.id] ?? [] : [];
  const draftLength = draft.length;
  const isSendDisabled = isBusy || !draft.trim();

  async function handleDevLogin(userId: string) {
    setIsBusy(true);
    try {
      const response = await api.devLogin(userId);
      localStorage.setItem(authStorageKey, response.token);
      setAuthToken(response.token);
      setError(null);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Не удалось войти.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleTelegramLogin() {
    setIsBusy(true);
    try {
      const response = await api.beginTelegramLogin();
      window.location.href = response.url;
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Не удалось начать вход через Telegram.");
      setIsBusy(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(authStorageKey);
    setAuthToken(null);
    setBootstrap(null);
    setSelectedChatId(null);
    setDraft("");
    setError(null);
  }

  async function handleSendMessage() {
    if (!authToken || !activeChat) {
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
      const response = await api.sendMessage(authToken, activeChat.id, text);
      setDraft("");
      setError(null);
      setBootstrap((currentPayload) => {
        if (!currentPayload) {
          return currentPayload;
        }

        return applyIncomingMessage(currentPayload, response.message);
      });
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Сообщение не отправилось.");
    } finally {
      setIsBusy(false);
    }
  }

  if (isLoading && authToken) {
    return (
      <div className="center-state">
        <div className="loading-card panel">
          <span className="eyebrow">Nexa запускается</span>
          <h1>Загружаю твой университетский мессенджер</h1>
          <p>Секунду, поднимаю сервер, чаты и текущую сессию.</p>
        </div>
      </div>
    );
  }

  if (!authToken || !bootstrap) {
    return (
      <div className="login-shell">
        <section className="brand-card panel">
          <span className="eyebrow">закрытый университетский мессенджер</span>
          <h1>Nexa</h1>
          <p className="brand-copy">
            Мессенджер для своей группы, курса или всего университета. Всё работает на отдельном сервере, а вход
            можно связать с Telegram.
          </p>
          <div className="pill-row">
            <span className="soft-pill">дизайн как мессенджер</span>
            <span className="soft-pill">свой сервер</span>
            <span className="soft-pill">пк и телефон</span>
          </div>
          <div className="feature-grid">
            <article className="feature-card">
              <h2>Своя сеть</h2>
              <p>Доступ только для своих людей, а не для всего интернета.</p>
            </article>
            <article className="feature-card">
              <h2>Вход через Telegram</h2>
              <p>Telegram ID можно использовать как основу аккаунта внутри Nexa.</p>
            </article>
            <article className="feature-card">
              <h2>Живой прототип</h2>
              <p>Уже есть чаты, сообщения, realtime и база, которую можно развивать дальше.</p>
            </article>
          </div>
        </section>

        <section className="auth-card panel">
          <div className="auth-header">
            <span className="eyebrow">вход</span>
            <h2>Войти в Nexa</h2>
            <p>Сейчас проще всего зайти как демо-пользователь. Реальный вход через Telegram подключим отдельно.</p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={handleTelegramLogin}
            disabled={isBusy || !providers?.telegram.enabled}
          >
            {providers?.telegram.enabled ? "Продолжить через Telegram" : "Вход через Telegram пока не настроен"}
          </button>

          <div className="divider">
            <span>или быстрый вход для проверки</span>
          </div>

          <div className="dev-user-list">
            {devUsers.map((user) => (
              <button
                type="button"
                key={user.id}
                className="user-card"
                onClick={() => handleDevLogin(user.id)}
                disabled={isBusy}
              >
                <span className="avatar" style={{ backgroundColor: user.accentColor }}>
                  {getInitials(user.name)}
                </span>
                <span className="user-copy">
                  <strong>{user.name}</strong>
                  <span>
                    @{user.username} · {roleCopy[user.role]}
                  </span>
                </span>
              </button>
            ))}
          </div>

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
            <span className="eyebrow">сервер nexa</span>
            <h1>{bootstrap.meta.serverName}</h1>
          </div>
          <span className={`status-chip status-${connectionLabel}`}>{connectionCopy[connectionLabel]}</span>
        </div>

        <div className="search-shell">
          <input className="search-input" value="Поиск скоро появится" readOnly />
        </div>

        <div className="sidebar-pills">
          <span className="soft-pill">{bootstrap.meta.universityName}</span>
          <span className="soft-pill">{bootstrap.meta.accessModel}</span>
        </div>

        <div className="chat-list">
          {bootstrap.chats.map((chat) => (
            <button
              type="button"
              key={chat.id}
              className={`chat-row ${activeChat?.id === chat.id ? "is-active" : ""}`}
              onClick={() => setSelectedChatId(chat.id)}
            >
              <span className="avatar" style={{ backgroundColor: chat.accentColor }}>
                {getInitials(chat.title)}
              </span>
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
                <span className="avatar large" style={{ backgroundColor: activeChat.accentColor }}>
                  {getInitials(activeChat.title)}
                </span>
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
                const author = bootstrap.users.find((user) => user.id === message.authorId);
                const isOwnMessage = message.authorId === bootstrap.currentUser.id;

                return (
                  <article key={message.id} className={`message-bubble ${isOwnMessage ? "own" : ""}`}>
                    {!isOwnMessage ? (
                      <span className="message-author" style={{ color: author?.accentColor }}>
                        {author?.name ?? "Неизвестный участник"}
                      </span>
                    ) : null}
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
                    setDraft(event.target.value);
                    if (error) {
                      setError(null);
                    }
                  }}
                  rows={1}
                  maxLength={maxMessageLength}
                />
                <div className="composer-meta">
                  <span className="char-counter">
                    {draftLength}/{maxMessageLength}
                  </span>
                </div>
              </div>
              <button type="button" className="primary-button compact" onClick={handleSendMessage} disabled={isSendDisabled}>
                Отправить
              </button>
            </footer>
          </>
        ) : (
          <div className="empty-state">
            <h2>Чаты появятся здесь</h2>
            <p>Как только у пользователя будут комнаты, они отобразятся в основной колонке.</p>
          </div>
        )}
      </main>

      <aside className="details-rail panel">
        <div className="profile-card">
          <span className="avatar xl" style={{ backgroundColor: bootstrap.currentUser.accentColor }}>
            {getInitials(bootstrap.currentUser.name)}
          </span>
          <h2>{bootstrap.currentUser.name}</h2>
          <p>@{bootstrap.currentUser.username}</p>
          <p>{bootstrap.currentUser.bio}</p>
        </div>

        <div className="detail-section">
          <span className="eyebrow">в этой версии</span>
          <ul className="detail-list">
            <li>Сервер уже отдельный и приватный.</li>
            <li>Вход через Telegram можно включить позже.</li>
            <li>Сообщения приходят в реальном времени.</li>
          </ul>
        </div>

        <div className="detail-section">
          <span className="eyebrow">текущий чат</span>
          <p>{activeChat?.title ?? "Чат не выбран"}</p>
          <p>{activeChat?.description ?? "Выбери чат слева, чтобы продолжить."}</p>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <button type="button" className="ghost-button" onClick={handleLogout}>
          Выйти
        </button>
      </aside>
    </div>
  );
}

export default App;
