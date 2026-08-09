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
  // Liberação financeira do recebimento (definida pelo administrador).
  payoutStatus?: PayoutStatus;
  // PIX próprio do médico (recebimento direto, sem Mercado Pago). Coexiste com o MP.
  // A chave/titular só são expostos ao paciente no momento de pagar aquele médico.
  pixAccept?: boolean; // "Aceitar pagamentos por PIX direto"
  pixKeyType?: PixKeyType;
  pixHolderName?: string; // nome do titular / favorecido
  pixHolderDoc?: string; // CPF/CNPJ do titular
  pixBank?: string; // nome do banco (Nubank, Itaú, Inter, ...)
  pixBusinessName?: string; // nome empresarial/fantasia (quando CNPJ)
}

export type PixKeyType = "cpf" | "cnpj" | "telefone" | "email" | "aleatoria";

export type PayoutStatus = "active" | "pending" | "blocked";

/** Repasse padrão do médico quando o administrador ainda não configurou (100% = sem retenção). */
export const DEFAULT_DOCTOR_SHARE_PERCENT = 100;

/** Normaliza o percentual de repasse do médico para um inteiro em [0, 100]. */
export function resolveDoctorSharePercent(doctor?: { commissionPercent?: number } | null): number {
  const raw = doctor?.commissionPercent;
  if (typeof raw !== "number" || Number.isNaN(raw)) return DEFAULT_DOCTOR_SHARE_PERCENT;
  return Math.min(100, Math.max(0, Math.round(raw)));
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
  // Comprovante de PIX direto enviado pelo paciente (confirmação é sempre manual do médico).
  proofStatus?: "enviado" | "recusado"; // ausente = nenhum comprovante ainda
  proofPath?: string; // caminho no storage/local do arquivo
  proofMime?: string;
  proofUploadedAt?: string;
  proofNote?: string; // motivo, quando o médico recusa
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
  | "payoutStatus"
  // Dados sensíveis do PIX não vão na lista pública; só `pixAccept` (booleano) fica visível.
  | "pixKeyType"
  | "pixHolderName"
  | "pixHolderDoc"
  | "pixBank"
  | "pixBusinessName"
>;
