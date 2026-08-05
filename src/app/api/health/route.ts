import { NextResponse } from "next/server";
import { readDb } from "@/lib/store";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const db = await readDb();
    return NextResponse.json({
      ok: true,
      service: "meu-rim",
      mode: getSupabaseAdmin() ? "supabase" : "demo",
      doctors: db.doctors.length,
      bookings: db.bookings.length,
      time: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "fail" },
      { status: 500 }
    );
  }
}
