import { NextResponse } from "next/server";
import { countBookings, listDoctors } from "@/lib/store";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const [doctors, bookings] = await Promise.all([listDoctors(), countBookings()]);
    return NextResponse.json({
      ok: true,
      service: "meu-rim",
      mode: getSupabaseAdmin() ? "supabase" : "demo",
      doctors: doctors.length,
      bookings,
      time: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "fail" },
      { status: 500 }
    );
  }
}
