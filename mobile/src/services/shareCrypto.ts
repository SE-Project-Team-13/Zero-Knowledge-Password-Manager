import { SecureStorageService } from "./secureStorage"

const PRIVATE_KEY_STORAGE_KEY = "share_private_key_pkcs8"
const PUBLIC_KEY_STORAGE_KEY = "share_public_key_spki"
const SIGN_PRIVATE_KEY_STORAGE_KEY = "share_sign_private_key_pkcs8"
const SIGN_PUBLIC_KEY_STORAGE_KEY = "share_sign_public_key_spki"

export interface ShareEnvelope {
  encryptedSessionKey: string
  ciphertext: string
  iv: string
  signature?: string
  senderSigningPublicKey?: string
}

export interface ShareKeyPair {
  publicKey: string
  privateKey: string
  signingPublicKey: string
  signingPrivateKey: string
}

function toBase64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength)
}

async function importPublicKey(spkiBase64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    fromBase64(spkiBase64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  )
}

async function importPrivateKey(pkcs8Base64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    fromBase64(pkcs8Base64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  )
}

async function importSigningPrivateKey(pkcs8Base64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    fromBase64(pkcs8Base64),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  )
}

async function importSigningPublicKey(spkiBase64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    fromBase64(spkiBase64),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  )
}

function buildSignaturePayload(envelope: {
  encryptedSessionKey: string
  ciphertext: string
  iv: string
  recipientEmail: string
}): string {
  return JSON.stringify({
    encryptedSessionKey: envelope.encryptedSessionKey,
    ciphertext: envelope.ciphertext,
    iv: envelope.iv,
    recipientEmail: envelope.recipientEmail.trim().toLowerCase(),
  })
}

export async function ensureShareKeyPair(): Promise<ShareKeyPair> {
  const existingPublic = await SecureStorageService.getItem(PUBLIC_KEY_STORAGE_KEY)
  const existingPrivate = await SecureStorageService.getItem(PRIVATE_KEY_STORAGE_KEY)
  const existingSignPublic = await SecureStorageService.getItem(SIGN_PUBLIC_KEY_STORAGE_KEY)
  const existingSignPrivate = await SecureStorageService.getItem(SIGN_PRIVATE_KEY_STORAGE_KEY)
  if (existingPublic && existingPrivate && existingSignPublic && existingSignPrivate) {
    return {
      publicKey: existingPublic,
      privateKey: existingPrivate,
      signingPublicKey: existingSignPublic,
      signingPrivateKey: existingSignPrivate,
    }
  }

  const pair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  )

  const publicKey = toBase64(await crypto.subtle.exportKey("spki", pair.publicKey))
  const privateKey = toBase64(await crypto.subtle.exportKey("pkcs8", pair.privateKey))

  const signingPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )
  const signingPublicKey = toBase64(await crypto.subtle.exportKey("spki", signingPair.publicKey))
  const signingPrivateKey = toBase64(await crypto.subtle.exportKey("pkcs8", signingPair.privateKey))

  await SecureStorageService.saveItem(PUBLIC_KEY_STORAGE_KEY, publicKey)
  await SecureStorageService.saveItem(PRIVATE_KEY_STORAGE_KEY, privateKey)
  await SecureStorageService.saveItem(SIGN_PUBLIC_KEY_STORAGE_KEY, signingPublicKey)
  await SecureStorageService.saveItem(SIGN_PRIVATE_KEY_STORAGE_KEY, signingPrivateKey)
  return { publicKey, privateKey, signingPublicKey, signingPrivateKey }
}

export async function createShareEnvelope(
  payload: unknown,
  recipientPublicKeyBase64: string,
  recipientEmail: string,
): Promise<ShareEnvelope> {
  const recipientPublicKey = await importPublicKey(recipientPublicKeyBase64)
  const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(payload))
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, plaintext)
  const rawAesKey = await crypto.subtle.exportKey("raw", aesKey)
  const encryptedSessionKey = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, recipientPublicKey, rawAesKey)
  const envelope = {
    encryptedSessionKey: toBase64(encryptedSessionKey),
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
  }
  const signingPrivateKeyBase64 = await SecureStorageService.getItem(SIGN_PRIVATE_KEY_STORAGE_KEY)
  const signingPublicKeyBase64 = await SecureStorageService.getItem(SIGN_PUBLIC_KEY_STORAGE_KEY)
  if (!signingPrivateKeyBase64 || !signingPublicKeyBase64) {
    throw new Error("No signing keys found for secure share")
  }
  const signingPrivateKey = await importSigningPrivateKey(signingPrivateKeyBase64)
  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingPrivateKey,
    new TextEncoder().encode(
      buildSignaturePayload({
        ...envelope,
        recipientEmail,
      }),
    ),
  )
  return {
    ...envelope,
    signature: toBase64(signatureBuffer),
    senderSigningPublicKey: signingPublicKeyBase64,
  }
}

export async function decryptShareEnvelope(envelope: ShareEnvelope): Promise<any> {
  const privateKeyBase64 = await SecureStorageService.getItem(PRIVATE_KEY_STORAGE_KEY)
  if (!privateKeyBase64) {
    throw new Error("No private key found for share decryption")
  }
  const privateKey = await importPrivateKey(privateKeyBase64)
  const rawSessionKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    fromBase64(envelope.encryptedSessionKey),
  )
  const aesKey = await crypto.subtle.importKey("raw", rawSessionKey, { name: "AES-GCM" }, false, ["decrypt"])
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(fromBase64(envelope.iv)) },
    aesKey,
    fromBase64(envelope.ciphertext),
  )
  const decoded = new TextDecoder().decode(plaintext)
  return JSON.parse(decoded)
}

export async function verifyShareEnvelopeSignature(
  envelope: ShareEnvelope,
  senderSigningPublicKey: string,
  recipientEmail: string,
): Promise<boolean> {
  if (!envelope.signature || !senderSigningPublicKey) return false
  const signingPublicKey = await importSigningPublicKey(senderSigningPublicKey)
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    signingPublicKey,
    fromBase64(envelope.signature),
    new TextEncoder().encode(
      buildSignaturePayload({
        encryptedSessionKey: envelope.encryptedSessionKey,
        ciphertext: envelope.ciphertext,
        iv: envelope.iv,
        recipientEmail,
      }),
    ),
  )
}