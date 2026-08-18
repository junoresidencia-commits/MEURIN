import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const SECRET = process.env.SESSION_SECRET || "meu-rim-dev-secret-change-me";
const COOKIE = "meurim_nutritionist_session";
const MAX_AGE = 60 * 60 * 24 * 365; // ~1 ano (persiste até logout)

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function createNutritionistToken(nutritionistId: string): string {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `${nutritionistId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyNutritionistToken(token: string | undefined): string | null {
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

export async function getNutritionistId(): Promise<string | null> {
  const jar = await cookies();
  return verifyNutritionistToken(jar.get(COOKIE)?.value);
}

export { COOKIE as NUTRITIONIST_COOKIE, MAX_AGE as NUTRITIONIST_MAX_AGE };
