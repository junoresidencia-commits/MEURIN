import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { ADMIN_COOKIE, createAdminToken, getAdminCredentials } from "@/lib/admin-session";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const creds = getAdminCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: "Admin não configurado. Defina ADMIN_EMAIL e ADMIN_PASSWORD." },
      { status: 503 }
    );
  }

  const { email, password } = await req.json();
  const okEmail = String(email || "").toLowerCase().trim() === creds.email;
  const okPass = safeEqual(String(password || ""), creds.password);
  if (!okEmail || !okPass) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
