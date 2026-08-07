import { NextResponse } from "next/server";
import { createPatientToken, PATIENT_COOKIE, PATIENT_SESSION_MAX_AGE } from "@/lib/patient-session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const { email } = await req.json();
  const normalized = String(email || "").toLowerCase().trim();
  if (!EMAIL_RE.test(normalized)) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, email: normalized });
  res.cookies.set(PATIENT_COOKIE, createPatientToken(normalized), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PATIENT_SESSION_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PATIENT_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
