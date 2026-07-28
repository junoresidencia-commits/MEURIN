import { NextResponse } from "next/server";
import { readDb } from "@/lib/store";

export async function GET() {
  try {
    const db = await readDb();
    return NextResponse.json({
      ok: true,
      service: "meu-rim",
      mode: "demo",
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
