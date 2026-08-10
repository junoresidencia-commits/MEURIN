import { promises as fs } from "fs";
import path from "path";

export type FunnelEventType =
  | "home_view"
  | "doctors_list_view"
  | "doctor_profile_open"
  | "schedule_click"
  | "slot_selected"
  | "payment_started"
  | "payment_completed"
  | "consultation_done"
  | "return_done"
  | "plan_hired"
  | "help_option_click"
  | "cta_patient_login"
  | "cta_doctor";

export type FunnelEvent = {
  id: string;
  type: FunnelEventType;
  path?: string;
  doctorId?: string;
  bookingId?: string;
  meta?: Record<string, string | number | boolean | null>;
  createdAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "funnel-events.json");

declare global {
  var __meuRimAnalytics: FunnelEvent[] | undefined;
}

async function loadPersisted(): Promise<FunnelEvent[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as FunnelEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function persist(events: FunnelEvent[]) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(events.slice(-5000), null, 2), "utf8");
  } catch {
    /* ignore — ephemeral envs may be read-only */
  }
}

async function mem(): Promise<FunnelEvent[]> {
  if (!globalThis.__meuRimAnalytics) {
    globalThis.__meuRimAnalytics = await loadPersisted();
  }
  return globalThis.__meuRimAnalytics;
}

export async function trackFunnelEvent(input: {
  type: FunnelEventType;
  path?: string;
  doctorId?: string;
  bookingId?: string;
  meta?: Record<string, string | number | boolean | null>;
}): Promise<FunnelEvent> {
  const event: FunnelEvent = {
    id: `fe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    path: input.path,
    doctorId: input.doctorId,
    bookingId: input.bookingId,
    meta: input.meta,
    createdAt: new Date().toISOString(),
  };

  const events = await mem();
  events.push(event);
  if (events.length > 5000) {
    globalThis.__meuRimAnalytics = events.slice(-5000);
  }
  await persist(globalThis.__meuRimAnalytics || events);
  return event;
}

export async function listFunnelEvents(limit = 2000): Promise<FunnelEvent[]> {
  const events = await mem();
  return events.slice(-limit);
}

export type FunnelSummary = {
  home_view: number;
  doctors_list_view: number;
  doctor_profile_open: number;
  schedule_click: number;
  slot_selected: number;
  payment_started: number;
  payment_completed: number;
  consultation_done: number;
  return_done: number;
  plan_hired: number;
  rates: {
    homeToDoctors: number | null;
    doctorsToProfile: number | null;
    profileToSchedule: number | null;
    scheduleToSlot: number | null;
    slotToPayment: number | null;
    paymentToPaid: number | null;
    paidToConsult: number | null;
    consultToReturn: number | null;
  };
};

function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

export async function summarizeFunnel(): Promise<FunnelSummary> {
  const events = await listFunnelEvents();
  const count = (t: FunnelEventType) => events.filter((e) => e.type === t).length;

  const home = count("home_view");
  const doctors = count("doctors_list_view");
  const profile = count("doctor_profile_open");
  const schedule = count("schedule_click");
  const slot = count("slot_selected");
  const payStart = count("payment_started");
  const payDone = count("payment_completed");
  const consult = count("consultation_done");
  const ret = count("return_done");
  const plan = count("plan_hired");

  return {
    home_view: home,
    doctors_list_view: doctors,
    doctor_profile_open: profile,
    schedule_click: schedule,
    slot_selected: slot,
    payment_started: payStart,
    payment_completed: payDone,
    consultation_done: consult,
    return_done: ret,
    plan_hired: plan,
    rates: {
      homeToDoctors: rate(doctors, home),
      doctorsToProfile: rate(profile, doctors),
      profileToSchedule: rate(schedule, profile),
      scheduleToSlot: rate(slot, schedule),
      slotToPayment: rate(payStart, slot),
      paymentToPaid: rate(payDone, payStart),
      paidToConsult: rate(consult, payDone),
      consultToReturn: rate(ret, consult),
    },
  };
}
