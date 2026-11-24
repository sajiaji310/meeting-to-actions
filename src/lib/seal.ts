import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto"

const SALT = "mnt-calendar-v1"
const keyCache = new Map<string, Buffer>()

function keyFor(secret: string) {
  const cached = keyCache.get(secret)
  if (cached) return cached
  const key = scryptSync(secret, SALT, 32)
  keyCache.set(secret, key)
  return key
}

export function sealJson(payload: unknown, secret: string) {
  if (!secret) throw new Error("SESSION_SECRET is empty")
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", keyFor(secret), iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64url")
}

export function unsealJson<T>(token: string, secret: string): T | null {
  if (!secret || !token) return null
  try {
    const buffer = Buffer.from(token, "base64url")
    if (buffer.length < 29) return null
    const iv = buffer.subarray(0, 12)
    const tag = buffer.subarray(12, 28)
    const encrypted = buffer.subarray(28)
    const decipher = createDecipheriv("aes-256-gcm", keyFor(secret), iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8")
    return JSON.parse(plain) as T
  } catch {
    return null
  }
}
