import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";

const N = 16384, R = 8, P = 1, KEYLEN = 64;
const derive = (pw: string, salt: Buffer, n: number, r: number, p: number) =>
  new Promise<Buffer>((res, rej) => scrypt(pw, salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));

/** scrypt$N$r$p$salt$hash (base64). Parameters are stored so they can be raised later. */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(pw, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt") return false;
  const key = await derive(pw, Buffer.from(salt, "base64"), +n, +r, +p);
  const expected = Buffer.from(hash, "base64");
  return key.length === expected.length && timingSafeEqual(key, expected);
}
export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newId = () => randomUUID();

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L: easy to copy by hand
/** 16 random characters (~80 bits) shown as XXXX-XXXX-XXXX-XXXX. Only a hash is stored. */
export function newRecoveryCode(): string {
  const bytes = randomBytes(16);
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return chars.match(/.{4}/g)!.join("-");
}
export const normalizeRecoveryCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");
