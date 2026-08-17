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

export type Modality = "presencial" | "teleconsulta";

/** Local de atendimento do médico (clínica/consultório/hospital). */
export interface DoctorLocation {
  id: string;
  name: string;
  city: string;
  address?: string;
  phone?: string;
  type: "clinica" | "consultorio" | "hospital" | "outro";
  active: boolean;
  cnes?: string; // CNES do estabelecimento (SUS/CEAF) — reutilizado na LME.
}

/** Período de disponibilidade por dia, com local/modalidade, duração, intervalo e valor. */
export interface AvailabilityPeriod {
  id: string;
  dayOfWeek: number; // 0=Dom … 6=Sáb
  start: string; // "08:00"
  end: string; // "12:00"
  modality: Modality;
  locationId?: string; // obrigatório quando presencial
  durationMin: number; // ex.: 30
  intervalMin: number; // ex.: 10
  priceCents?: number; // valor específico do período/local (senão usa consultationPriceCents)
}

/** Reserva temporária de horário (anti dupla marcação), com expiração. */
export interface AppointmentHold {
  id: string;
  doctorId: string;
  slotStart: string; // ISO
  holder: string; // sessão/e-mail do paciente
  expiresAt: string; // ISO
  createdAt: string;
}

export type DoctorStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended"
  | "correction";

export type PixKeyType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

/** Perfil Pix do médico para recebimento direto (dados do recebedor). */
export interface PixProfile {
  keyType?: PixKeyType;
  key?: string;
  holderName?: string; // nome do titular da chave
  holderDoc?: string; // CPF/CNPJ do titular
  bank?: string; // banco/instituição
  city?: string; // cidade do recebedor (para o BR Code)
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
  /** Perfil Pix estruturado (recebimento direto). Complementa pixKey (legado). */
  pixProfile?: PixProfile;
  weeklyAvailability: WeeklySlot[];
  // Agenda avançada (locais + períodos por modalidade). Quando vazia, usa weeklyAvailability.
  locations?: DoctorLocation[];
  availabilityPeriods?: AvailabilityPeriod[];
  blockedSlots: string[]; // ISO datetimes already taken or blocked
  createdAt: string;
  // Aprovação e dados cadastrais (fluxo de aprovação pelo administrador)
  status: DoctorStatus;
  phone?: string;
  crmState?: string;
  rqe?: string;
  clinic?: string;
  cns?: string; // Cartão Nacional de Saúde do médico (SUS/CEAF). Preenchido uma vez, reutilizado nas LMEs.
  adminNote?: string;
  // Logo do médico (data URL base64) exibida no cabeçalho dos documentos/PDF.
  logoUrl?: string;
  // WhatsApp e comunicação (privacidade):
  // - notifyWhatsapp: número INTERNO do médico p/ receber avisos (NUNCA exposto ao paciente).
  // - patientContactWhatsapp: número para o paciente falar (pode ser secretária/clínica).
  // - allowPatientContact: habilita o paciente a abrir conversa (usando o número acima).
  notifyWhatsapp?: string;
  useWhatsappNotifications?: boolean; // legado (mantido por compatibilidade)
  patientContactWhatsapp?: string;
  allowPatientContact?: boolean;
  notifyNewBookings?: boolean;
  notifyPayments?: boolean;
  notifyReschedules?: boolean;
  // Token do Mercado Pago do próprio médico: quando presente, o pagamento da
  // consulta é cobrado na conta dele (segredo — nunca enviado ao navegador).
  mpAccessToken?: string;
  // Percentual de repasse do médico (0–100). Definido SOMENTE pelo administrador.
  // Ex.: 80 => médico recebe 80%, plataforma 20%. Ausente => 100% (repasse total).
  commissionPercent?: number;
  // Liberação financeira do recebimento (definida pelo administrador).
  payoutStatus?: PayoutStatus;
  // Notificações no celular (push) + lembretes + calendário + fuso.
  notifyPush?: boolean;
  notifyReminder24?: boolean;
  notifyReminder2?: boolean;
  // Título do evento no calendário do médico. Padrão: "meurim" (não expõe o nome do paciente).
  calendarEventMode?: CalendarEventMode;
  tz?: string; // fuso horário do médico. Padrão America/Bahia.
}

export type PayoutStatus = "active" | "pending" | "blocked";

export type CalendarEventMode = "meurim" | "patient";

/** Papel do destinatário/dono do dispositivo de push. */
export type NotifyRole = "medico" | "paciente";

/** Dispositivo/assinatura de push de um usuário (pode ter vários). */
export interface PushDevice {
  id: string;
  userId: string; // id do médico ou chave do paciente
  role: NotifyRole;
  platform: "web" | "ios" | "android";
  endpoint: string;
  subscription: PushSubscriptionJSONish;
  deviceName?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

/** Formato serializável de um PushSubscription (o que o navegador envia). */
export interface PushSubscriptionJSONish {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

/** Notificação in-app (central de notificações) + histórico do que foi enviado. */
export interface AppNotification {
  id: string;
  userId: string;
  role: NotifyRole;
  type: string;
  title: string;
  message?: string;
  targetUrl?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  readAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

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
  // Modalidade e local (presencial) da consulta.
  modality?: Modality;
  locationId?: string;
  locationName?: string;
  // Fluxo de confirmação/remarcação (separado do pagamento). Ausente = fluxo antigo.
  stage?: ConsultationStage;
  events?: ConsultationEvent[]; // linha do tempo (registro oficial)
  // Proposta de novo horário feita pelo médico (aguardando resposta do paciente).
  proposedSlotStart?: string;
  proposedSlotEnd?: string;
  proposalMessage?: string;
  proposalBy?: string;
  notRealizedReason?: string;
  // Lembretes já enviados (evita reenviar). 24h e 2h antes da consulta.
  reminder24Sent?: boolean;
  reminder2Sent?: boolean;
}

export type ConsultationStage =
  | "aguardando_confirmacao" // paciente solicitou/pagou; aguarda o médico
  | "confirmada"
  | "proposto_novo_horario"
  | "remarcada"
  | "realizada"
  | "nao_realizada"
  | "cancelada";

export interface ConsultationEvent {
  at: string;
  actor: "paciente" | "medico" | "sistema";
  type: string; // ex.: 'solicitada','pagamento','confirmada','proposta','remarcada','cancelada','nao_realizada'
  detail?: string;
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

/** Dados públicos do médico (sem segredos). Inclui confiança profissional para a agenda. */
export type PublicDoctor = Pick<
  Doctor,
  | "id"
  | "name"
  | "email"
  | "crm"
  | "specialty"
  | "bio"
  | "consultationPriceCents"
  | "stripeConnectReady"
  | "weeklyAvailability"
  | "blockedSlots"
  | "createdAt"
  | "crmState"
  | "rqe"
  | "clinic"
  | "logoUrl"
  | "locations"
  | "availabilityPeriods"
> & {
  /** Cidades/regiões de atendimento presencial (derivado de locations). */
  cities?: string[];
  /** True se houver período ou disponibilidade para teleconsulta. */
  onlineAvailable?: boolean;
};
