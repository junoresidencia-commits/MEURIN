import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { buildConfirmationEmail, logEmail } from "@/lib/email";
import { updateDb } from "@/lib/store";

export async function POST(req: Request) {
  const { bookingId, cardLast4 } = await req.json();
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId obrigatório" }, { status: 400 });
  }

  let meetingUrl = "";
  let emailPreview = null as null | { to: string; subject: string; body: string };

  const result = await updateDb((db) => {
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) return db;
    if (booking.status === "confirmed" || booking.status === "paid") {
      return db;
    }

    const doctor = db.doctors.find((d) => d.id === booking.doctorId);
    if (!doctor) return db;

    // Platform fee demo: 5% — rest goes to the doctor's account
    const platformFeeCents = Math.round(booking.priceCents * 0.05);
    const doctorPayoutCents = booking.priceCents - platformFeeCents;
    const paymentId = uuid();
    const paidAt = new Date().toISOString();

    void cardLast4;
    const payment = {
      id: paymentId,
      bookingId: booking.id,
      doctorId: doctor.id,
      amountCents: booking.priceCents,
      method: booking.paymentMethod,
      status: "succeeded" as const,
      doctorPayoutCents,
      platformFeeCents,
      createdAt: paidAt,
    };

    const updatedBooking = {
      ...booking,
      status: "confirmed" as const,
      paymentId,
      paidAt,
      confirmationEmailSent: true,
    };

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    meetingUrl = `${origin}/consulta/${updatedBooking.meetingRoomId}`;
    emailPreview = buildConfirmationEmail(updatedBooking, doctor, meetingUrl);
    logEmail(emailPreview);

    return {
      ...db,
      bookings: db.bookings.map((b) => (b.id === bookingId ? updatedBooking : b)),
      payments: [...db.payments, payment],
      doctors: db.doctors.map((d) =>
        d.id === doctor.id
          ? { ...d, blockedSlots: [...d.blockedSlots, booking.slotStart] }
          : d
      ),
    };
  });

  const booking = result.bookings.find((b) => b.id === bookingId);
  if (!booking) {
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  }

  const payment = result.payments.find((p) => p.bookingId === bookingId);

  return NextResponse.json({
    booking,
    payment,
    meetingUrl,
    email: emailPreview,
  });
}
