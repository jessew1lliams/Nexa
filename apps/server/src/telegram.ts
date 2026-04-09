import { createHash, randomBytes } from "node:crypto";

import { createRemoteJWKSet, jwtVerify } from "jose";

import type { appConfig } from "./config.js";
import type { TelegramProfile } from "./types.js";

type TelegramConfig = typeof appConfig;

const telegramKeys = createRemoteJWKSet(new URL("https://oauth.telegram.org/.well-known/jwks.json"));
const pendingStates = new Map<string, { codeVerifier: string; createdAt: number }>();
const stateLifetimeMs = 10 * 60_000;

function pruneStates() {
  const now = Date.now();
  for (const [state, pending] of pendingStates.entries()) {
    if (now - pending.createdAt > stateLifetimeMs) {
      pendingStates.delete(state);
    }
  }
}

function buildChallenge(codeVerifier: string) {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

export function beginTelegramLogin(config: TelegramConfig) {
  pruneStates();

  const state = randomBytes(16).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");

  pendingStates.set(state, {
    codeVerifier,
    createdAt: Date.now()
  });

  const params = new URLSearchParams({
    client_id: config.telegramClientId,
    redirect_uri: config.telegramRedirectUri,
    response_type: "code",
    scope: config.telegramScopes,
    state,
    code_challenge: buildChallenge(codeVerifier),
    code_challenge_method: "S256"
  });

  return {
    url: `https://oauth.telegram.org/auth?${params.toString()}`
  };
}

export async function completeTelegramLogin(config: TelegramConfig, code: string, state: string) {
  pruneStates();

  const pending = pendingStates.get(state);
  if (!pending) {
    throw new Error("Telegram state is missing or expired.");
  }

  pendingStates.delete(state);

  const basicAuth = Buffer.from(`${config.telegramClientId}:${config.telegramClientSecret}`).toString("base64");
  const tokenResponse = await fetch("https://oauth.telegram.org/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.telegramRedirectUri,
      client_id: config.telegramClientId,
      code_verifier: pending.codeVerifier
    })
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Telegram token exchange failed: ${errorText}`);
  }

  const tokenPayload = (await tokenResponse.json()) as { id_token?: string };
  if (!tokenPayload.id_token) {
    throw new Error("Telegram did not return an id_token.");
  }

  const { payload } = await jwtVerify(tokenPayload.id_token, telegramKeys, {
    issuer: "https://oauth.telegram.org",
    audience: config.telegramClientId
  });

  const rawTelegramId = payload.id ?? payload.sub;
  const telegramId = Number(rawTelegramId);

  if (!Number.isFinite(telegramId)) {
    throw new Error("Telegram did not return a valid user id.");
  }

  const profile: TelegramProfile = {
    telegramId,
    name: typeof payload.name === "string" ? payload.name : "Telegram User",
    username: typeof payload.preferred_username === "string" ? payload.preferred_username : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
    phoneNumber: typeof payload.phone_number === "string" ? payload.phone_number : undefined
  };

  return profile;
}
