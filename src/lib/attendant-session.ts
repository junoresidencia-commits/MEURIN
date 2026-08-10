import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const SECRET = process.env.SESSION_SECRET || "meu-rim-dev-secret-change-me";
const COOKIE = "meurim_attendant_session";
const MAX_AGE = 60 * 60 * 24 * 365; // ~1 ano (persiste até logout)

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function createAttendantToken(attendantId: string): string {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `${attendantId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAttendantToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, expStr, sig] = parts;
  const payload = `${id}.${expStr}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  if (Number(expStr) < Date.now()) return null;
  return id;
}

export async function getAttendantId(): Promise<string | null> {
  const jar = await cookies();
  return verifyAttendantToken(jar.get(COOKIE)?.value);
}

export { COOKIE as ATTENDANT_COOKIE, MAX_AGE as ATTENDANT_MAX_AGE };
