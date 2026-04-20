const cryptoStorageKey = "nexa-device-crypto-v1";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const directMessagePrefix = "nexa-e2ee-v1:";

type StoredCryptoEntry = {
  publicKey: string;
  privateKey: string;
  createdAt: string;
};

type StoredCryptoMap = Record<string, StoredCryptoEntry>;

type EncryptedEnvelope = {
  v: 1;
  alg: "ECDH-P256/AES-GCM-256";
  iv: string;
  data: string;
};

function readStoredCryptoMap() {
  if (typeof window === "undefined") {
    return {} as StoredCryptoMap;
  }

  try {
    const raw = window.localStorage.getItem(cryptoStorageKey);
    return raw ? (JSON.parse(raw) as StoredCryptoMap) : {};
  } catch {
    return {} as StoredCryptoMap;
  }
}

function saveStoredCryptoMap(nextMap: StoredCryptoMap) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(cryptoStorageKey, JSON.stringify(nextMap));
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }

  return window.btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function importPrivateKey(encodedPrivateKey: string) {
  return window.crypto.subtle.importKey(
    "pkcs8",
    base64ToBytes(encodedPrivateKey),
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    false,
    ["deriveBits"]
  );
}

async function importPublicKey(encodedPublicKey: string) {
  return window.crypto.subtle.importKey(
    "raw",
    base64ToBytes(encodedPublicKey),
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    false,
    []
  );
}

async function deriveDirectChatAesKey(currentUserId: string, peerPublicKey: string, chatId: string) {
  const storedEntry = readStoredCryptoMap()[currentUserId];
  if (!storedEntry) {
    throw new Error("device_crypto_missing");
  }

  const privateKey = await importPrivateKey(storedEntry.privateKey);
  const publicKey = await importPublicKey(peerPublicKey);
  const sharedBits = await window.crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: publicKey
    },
    privateKey,
    256
  );

  const hkdfKey = await window.crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveKey"]);
  return window.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: textEncoder.encode(`nexa-direct:${chatId}`),
      info: textEncoder.encode("nexa-direct-message-v1")
    },
    hkdfKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export function isEncryptedDirectMessagePayload(value: string) {
  return value.startsWith(directMessagePrefix);
}

export async function ensureStoredCryptoIdentity(userId: string) {
  const storedMap = readStoredCryptoMap();
  const existingEntry = storedMap[userId];
  if (existingEntry?.publicKey && existingEntry.privateKey) {
    return existingEntry;
  }

  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true,
    ["deriveBits"]
  );

  const [publicKeyBuffer, privateKeyBuffer] = await Promise.all([
    window.crypto.subtle.exportKey("raw", keyPair.publicKey),
    window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey)
  ]);

  const nextEntry: StoredCryptoEntry = {
    publicKey: bytesToBase64(new Uint8Array(publicKeyBuffer)),
    privateKey: bytesToBase64(new Uint8Array(privateKeyBuffer)),
    createdAt: new Date().toISOString()
  };

  saveStoredCryptoMap({
    ...storedMap,
    [userId]: nextEntry
  });

  return nextEntry;
}

export async function encryptDirectMessagePayload(currentUserId: string, peerPublicKey: string, chatId: string, text: string) {
  const aesKey = await deriveDirectChatAesKey(currentUserId, peerPublicKey, chatId);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv
    },
    aesKey,
    textEncoder.encode(text)
  );

  const envelope: EncryptedEnvelope = {
    v: 1,
    alg: "ECDH-P256/AES-GCM-256",
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encryptedBuffer))
  };

  return `${directMessagePrefix}${bytesToBase64(textEncoder.encode(JSON.stringify(envelope)))}`;
}

export async function decryptDirectMessagePayload(currentUserId: string, peerPublicKey: string, chatId: string, payload: string) {
  if (!isEncryptedDirectMessagePayload(payload)) {
    return payload;
  }

  const encodedEnvelope = payload.slice(directMessagePrefix.length);
  const parsedEnvelope = JSON.parse(textDecoder.decode(base64ToBytes(encodedEnvelope))) as EncryptedEnvelope;
  const aesKey = await deriveDirectChatAesKey(currentUserId, peerPublicKey, chatId);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(parsedEnvelope.iv)
    },
    aesKey,
    base64ToBytes(parsedEnvelope.data)
  );

  return textDecoder.decode(decryptedBuffer);
}
