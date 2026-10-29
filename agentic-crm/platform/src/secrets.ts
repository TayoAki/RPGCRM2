import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const randomHex = (bytes = 32) => randomBytes(bytes).toString("hex");
export const randomBase64 = (bytes = 32) => randomBytes(bytes).toString("base64");
export const hmacHex = (secret: string, value: string) =>
  createHmac("sha256", secret).update(value).digest("hex");
export const hashOf = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export function sameHash(value: string, hash: string): boolean {
  const given = Buffer.from(hashOf(value), "hex");
  const expected = Buffer.from(hash, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const keyFrom = (secret: string) => createHash("sha256").update(secret).digest();

/** AES-256-GCM, for the few secrets the platform has to read back (a workspace's setup token). */
export function encrypt(secret: string, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body]
    .map((part) => part.toString("base64"))
    .join(".");
}

export function decrypt(secret: string, sealed: string): string {
  const [iv, tag, body] = sealed.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), iv as Buffer);
  decipher.setAuthTag(tag as Buffer);
  return Buffer.concat([decipher.update(body as Buffer), decipher.final()]).toString("utf8");
}
