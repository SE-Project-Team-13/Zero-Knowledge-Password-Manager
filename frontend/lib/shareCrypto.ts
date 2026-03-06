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

const getPrivateKeyKey = (userId?: string) => userId ? `share_private_key_pkcs8_${userId}` : "share_private_key_pkcs8"
const getPublicKeyKey = (userId?: string) => userId ? `share_public_key_spki_${userId}` : "share_public_key_spki"
const getSignPrivateKeyKey = (userId?: string) => userId ? `share_sign_private_key_pkcs8_${userId}` : "share_sign_private_key_pkcs8"
const getSignPublicKeyKey = (userId?: string) => userId ? `share_sign_public_key_spki_${userId}` : "share_sign_public_key_spki"

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

export async function ensureShareKeyPair(userId?: string, allowGenerate = true): Promise<ShareKeyPair | null> {
  const pkKey = getPrivateKeyKey(userId)
  const pubKey = getPublicKeyKey(userId)
  const sPkKey = getSignPrivateKeyKey(userId)
  const sPubKey = getSignPublicKeyKey(userId)

  let existingPublic = localStorage.getItem(pubKey)
  let existingPrivate = localStorage.getItem(pkKey)
  let existingSignPublic = localStorage.getItem(sPubKey)
  let existingSignPrivate = localStorage.getItem(sPkKey)
  
  console.log(`[shareCrypto] Checked keys for ${userId || "legacy"}:`, {
    pub: !!existingPublic,
    priv: !!existingPrivate,
    sPub: !!existingSignPublic,
    sPriv: !!existingSignPrivate
  })
  
  // Migration: If scoped keys missing but legacy exist, migrate them
  if (userId && (!existingPublic || !existingPrivate || !existingSignPublic || !existingSignPrivate)) {
    const legacyPublic = localStorage.getItem(getPublicKeyKey())
    const legacyPrivate = localStorage.getItem(getPrivateKeyKey())
    const legacySignPublic = localStorage.getItem(getSignPublicKeyKey())
    const legacySignPrivate = localStorage.getItem(getSignPrivateKeyKey())

    if (legacyPublic && legacyPrivate && legacySignPublic && legacySignPrivate) {
      console.log(`[shareCrypto] Migrating legacy sharing keys for user: ${userId}`)
      localStorage.setItem(pubKey, legacyPublic)
      localStorage.setItem(pkKey, legacyPrivate)
      localStorage.setItem(sPubKey, legacySignPublic)
      localStorage.setItem(sPkKey, legacySignPrivate)
      existingPublic = legacyPublic
      existingPrivate = legacyPrivate
      existingSignPublic = legacySignPublic
      existingSignPrivate = legacySignPrivate
    }
  }

  if (existingPublic && existingPrivate && existingSignPublic && existingSignPrivate) {
    return {
      publicKey: existingPublic,
      privateKey: existingPrivate,
      signingPublicKey: existingSignPublic,
      signingPrivateKey: existingSignPrivate,
    }
  }
  
  if (!allowGenerate) {
    console.log(`[shareCrypto] Keys missing for ${userId || "legacy"}, but allowGenerate is false. Returning null.`)
    return null;
  }

  console.log(`[shareCrypto] Generating new sharing keys for user: ${userId || "legacy"}`)
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

  localStorage.setItem(pubKey, publicKey)
  localStorage.setItem(pkKey, privateKey)
  localStorage.setItem(sPubKey, signingPublicKey)
  localStorage.setItem(sPkKey, signingPrivateKey)
  return { publicKey, privateKey, signingPublicKey, signingPrivateKey }
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

export async function createShareEnvelope(
  payload: unknown,
  recipientPublicKeyBase64: string,
  recipientEmail: string,
  userId?: string,
): Promise<ShareEnvelope> {
  const keys = await ensureShareKeyPair(userId)
  if (!keys) throw new Error("Sharing keys not available");

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

  const signingPrivateKey = await importSigningPrivateKey(keys.signingPrivateKey)
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
    senderSigningPublicKey: keys.signingPublicKey,
  }
}

export async function decryptShareEnvelope(envelope: ShareEnvelope, userId?: string, expectedRecipient?: string): Promise<any> {
  const pkKey = getPrivateKeyKey(userId)
  const privateKeyBase64 = localStorage.getItem(pkKey)
  if (!privateKeyBase64) {
    console.error(`[shareCrypto] Decryption failed: No private key in localStorage (${pkKey}) for user ${userId || 'legacy'}`)
    throw new Error("No private key found for share decryption")
  }
  
  console.log(`[shareCrypto] Decrypting for recipient: ${expectedRecipient || 'unknown'} using LOCAL userId: ${userId || 'legacy'}`)
  console.log(`[shareCrypto] Found private key (starts with): ${privateKeyBase64.substring(0, 20)}...`)
  console.log(`[shareCrypto] Encrypted session key length (base64): ${envelope.encryptedSessionKey.length}`)

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

