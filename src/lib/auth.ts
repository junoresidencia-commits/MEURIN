import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const SECRET = process.env.SESSION_SECRET || "meu-rim-dev-secret-change-me";
const COOKIE = "meurim_doctor_session";
// Sessão persiste até o médico clicar em "Sair" (~1 ano).
const MAX_AGE = 60 * 60 * 24 * 365;

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function createSessionToken(doctorId: string): string {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `${doctorId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [doctorId, expStr, sig] = parts;
  const payload = `${doctorId}.${expStr}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  if (Number(expStr) < Date.now()) return null;
  return doctorId;
}

export async function getDoctorSessionId(): Promise<string | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(COOKIE)?.value);
}

export { COOKIE, MAX_AGE as DOCTOR_MAX_AGE };
