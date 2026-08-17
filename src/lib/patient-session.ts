import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const SECRET = process.env.SESSION_SECRET || "meu-rim-dev-secret-change-me";
const COOKIE = "meurim_patient_session";

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

function encodeEmail(email: string): string {
  return Buffer.from(email, "utf8").toString("base64url");
}

function decodeEmail(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString("utf8");
}

// Sessão do paciente persiste até clicar em "Sair" (~1 ano).
const MAX_AGE = 60 * 60 * 24 * 365;

export function createPatientToken(email: string): string {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `${encodeEmail(email.toLowerCase().trim())}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyPatientToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encoded, expStr, sig] = parts;
  const payload = `${encoded}.${expStr}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  if (Number(expStr) < Date.now()) return null;
  try {
    return decodeEmail(encoded);
  } catch {
    return null;
  }
}

export async function getPatientEmail(): Promise<string | null> {
  const jar = await cookies();
  return verifyPatientToken(jar.get(COOKIE)?.value);
}

export { COOKIE as PATIENT_COOKIE };
