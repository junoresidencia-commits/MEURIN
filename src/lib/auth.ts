import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const SECRET = process.env.SESSION_SECRET || "meu-rim-dev-secret-change-me";
const COOKIE = "meurim_doctor_session";

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

// Sessão longa: o médico permanece logado até clicar em "Sair".
export const DOCTOR_SESSION_MAX_AGE = 60 * 60 * 24 * 365;

export function createSessionToken(doctorId: string): string {
  const exp = Date.now() + 1000 * DOCTOR_SESSION_MAX_AGE;
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

export { COOKIE };
