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

export type DoctorStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended"
  | "correction";

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
  // Aprovação e dados cadastrais (fluxo de aprovação pelo administrador)
  status: DoctorStatus;
  phone?: string;
  crmState?: string;
  rqe?: string;
  clinic?: string;
  adminNote?: string;
  // Logo do médico (data URL base64) exibida no cabeçalho dos documentos/PDF.
  logoUrl?: string;
  // Token do Mercado Pago do próprio médico: quando presente, o pagamento da
  // consulta é cobrado na conta dele (segredo — nunca enviado ao navegador).
  mpAccessToken?: string;
  // Percentual de repasse do médico (0–100). Definido SOMENTE pelo administrador.
  // Ex.: 80 => médico recebe 80%, plataforma 20%. Ausente => 100% (repasse total).
  commissionPercent?: number;
  // Percentuais específicos por serviço (opcionais). Ausentes => usam o padrão acima.
  consultaCommissionPercent?: number;
  planCommissionPercent?: number;
  // Liberação financeira do recebimento (definida pelo administrador).
  payoutStatus?: PayoutStatus;
}

export type PayoutStatus = "active" | "pending" | "blocked";

/** Repasse padrão do médico quando o administrador ainda não configurou (100% = sem retenção). */
export const DEFAULT_DOCTOR_SHARE_PERCENT = 100;

/** Normaliza o percentual de repasse do médico para um inteiro em [0, 100]. */
export function resolveDoctorSharePercent(doctor?: { commissionPercent?: number } | null): number {
  const raw = doctor?.commissionPercent;
  if (typeof raw !== "number" || Number.isNaN(raw)) return DEFAULT_DOCTOR_SHARE_PERCENT;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

/**
 * Repasse do médico para um serviço específico (consulta avulsa ou plano).
 * Usa o override do serviço quando definido pelo admin; senão, o percentual padrão.
 */
export function resolveServiceSharePercent(
  doctor:
    | {
        commissionPercent?: number;
        consultaCommissionPercent?: number;
        planCommissionPercent?: number;
      }
    | null
    | undefined,
  service: "consulta" | "plan"
): number {
  const override =
    service === "consulta" ? doctor?.consultaCommissionPercent : doctor?.planCommissionPercent;
  if (typeof override === "number" && !Number.isNaN(override)) {
    return Math.min(100, Math.max(0, Math.round(override)));
  }
  return resolveDoctorSharePercent(doctor);
}

/** Divide o valor bruto entre médico e plataforma conforme o percentual de repasse. */
export function computeSplit(
  priceCents: number,
  doctorSharePercent: number
): { doctorPayoutCents: number; platformFeeCents: number } {
  const share = Math.min(100, Math.max(0, Math.round(doctorSharePercent)));
  const doctorPayoutCents = Math.round((priceCents * share) / 100);
  return { doctorPayoutCents, platformFeeCents: priceCents - doctorPayoutCents };
}

export interface Booking {
  id: string;
  doctorId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  patientCity: string;
  careReason: "pressa" | "acompanhamento" | "segunda_opiniao" | "outro";
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
  // Snapshot do percentual de repasse aplicado neste pagamento (histórico imutável).
  doctorSharePercent?: number;
  createdAt: string;
}

/** Evento no histórico financeiro do médico (mudança de preço, percentual ou liberação). */
export interface FinancialEvent {
  id: string;
  doctorId: string;
  kind: "price" | "commission" | "payout_status";
  oldValue: string | null;
  newValue: string;
  changedBy: "admin" | "medico";
  note?: string;
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

export type PublicDoctor = Omit<
  Doctor,
  | "passwordHash"
  | "pixKey"
  | "bankAccountHint"
  | "status"
  | "phone"
  | "crmState"
  | "rqe"
  | "clinic"
  | "adminNote"
  | "mpAccessToken"
  | "commissionPercent"
  | "consultaCommissionPercent"
  | "planCommissionPercent"
  | "payoutStatus"
>;
