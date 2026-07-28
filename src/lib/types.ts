export type PaymentMethod = "card" | "pix" | "boleto";

export type BookingStatus =
  | "pending_payment"
  | "paid"
  | "confirmed"
  | "completed"
  | "cancelled";

export interface WeeklySlot {
  dayOfWeek: number; // 0=Sun … 6=Sat
  start: string; // "09:00"
  end: string; // "12:00"
}

export interface Doctor {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  crm: string;
  specialty: string;
  bio: string;
  consultationPriceCents: number;
  pixKey?: string;
  bankAccountHint?: string;
  stripeConnectReady: boolean;
  weeklyAvailability: WeeklySlot[];
  blockedSlots: string[]; // ISO datetimes already taken or blocked
  createdAt: string;
}

export interface Booking {
  id: string;
  doctorId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  slotStart: string; // ISO
  slotEnd: string;
  priceCents: number;
  paymentMethod: PaymentMethod;
  status: BookingStatus;
  meetingRoomId: string;
  paymentId?: string;
  paidAt?: string;
  confirmationEmailSent: boolean;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  bookingId: string;
  doctorId: string;
  amountCents: number;
  method: PaymentMethod;
  status: "succeeded" | "failed" | "pending";
  doctorPayoutCents: number;
  platformFeeCents: number;
  createdAt: string;
}

export interface SignalingMessage {
  id: string;
  roomId: string;
  from: "doctor" | "patient";
  type: "offer" | "answer" | "ice";
  payload: string;
  createdAt: string;
}

export interface Database {
  doctors: Doctor[];
  bookings: Booking[];
  payments: PaymentRecord[];
  signaling: SignalingMessage[];
}

export type PublicDoctor = Omit<Doctor, "passwordHash" | "pixKey" | "bankAccountHint">;
