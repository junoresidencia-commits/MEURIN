import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { COOKIE, createSessionToken, getDoctorSessionId } from "@/lib/auth";
import { readDb } from "@/lib/store";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) {
    return NextResponse.json({ doctor: null });
  }
  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor) return NextResponse.json({ doctor: null });
  const { passwordHash, ...safe } = doctor;
  void passwordHash;
  return NextResponse.json({ doctor: safe });
}

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const db = await readDb();
  const doctor = db.doctors.find(
    (d) => d.email.toLowerCase() === String(email || "").toLowerCase()
  );
  if (!doctor || !(await bcrypt.compare(String(password || ""), doctor.passwordHash))) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  const token = createSessionToken(doctor.id);
  const res = NextResponse.json({
    ok: true,
    doctor: {
      id: doctor.id,
      name: doctor.name,
      email: doctor.email,
    },
  });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
