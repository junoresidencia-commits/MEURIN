"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PatientNav } from "@/components/PatientNav";
import { formatSlotLabel } from "@/lib/scheduling-client";

type HomeRecord = {
  id: string;
  kind: "bp" | "glucose" | "weight" | "symptom";
  systolic?: number | null;
  diastolic?: number | null;
  heartRate?: number | null;
  glucoseMgDl?: number | null;
  glucoseContext?: string | null;
  weightKg?: number | null;
  symptoms?: string | null;
  note?: string | null;
  measuredAt: string;
};

type FoodLog = { id: string; food: string; meal?: string | null; loggedAt: string };

type Booking = {
  id: string;
  status: string;
  slotStart: string;
  doctorName: string;
  meetingRoomId: string;
};

function latest(records: HomeRecord[], kind: HomeRecord["kind"]) {
  return records.find((r) => r.kind === kind) || null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "agora há pouco";
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

export default function PacienteInicioPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [records, setRecords] = useState<HomeRecord[]>([]);
  const [food, setFood] = useState<FoodLog[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/patient/records");
    if (res.status === 401) {
      router.replace("/paciente/entrar");
      return;
    }
    const data = await res.json();
    setEmail(data.email || "");
    setRecords(data.records || []);
    setFood(data.food || []);
    if (data.email) {
      try {
        const b = await fetch(`/api/bookings/lookup?email=${encodeURIComponent(data.email)}`);
        const bd = await b.json();
        setBookings(bd.bookings || []);
      } catch {
        /* ignore */
      }
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function logout() {
    await fetch("/api/patient/session", { method: "DELETE" });
    router.replace("/paciente/entrar");
  }

  const bp = latest(records, "bp");
  const glucose = latest(records, "glucose");
  const weight = latest(records, "weight");
  const nextBooking = bookings
    .filter((b) => new Date(b.slotStart).getTime() > Date.now() - 3_600_000)
    .sort((a, b) => a.slotStart.localeCompare(b.slotStart))[0];
  const name = email ? email.split("@")[0] : "";

  if (loading) {
    return (
      <div className="mx-auto max-w-[560px] px-5 py-10">
        <div className="h-8 w-40 animate-pulse rounded-full bg-[var(--border)]" />
        <div className="mt-6 grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-[22px] bg-[var(--border)]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] px-5 pb-28 pt-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold capitalize text-[var(--text)]">
            Olá, {name}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Como você está hoje?</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]"
        >
          Sair
        </button>
      </div>

      <p className="mt-6 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
        Resumo do dia
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <SummaryCard
          label="Pressão arterial"
          value={bp ? `${bp.systolic}/${bp.diastolic}` : "—"}
          unit={bp ? "mmHg" : ""}
          hint={bp ? timeAgo(bp.measuredAt) : "Sem registro"}
          tone="rose"
        />
        <SummaryCard
          label="Glicemia"
          value={glucose ? String(glucose.glucoseMgDl) : "—"}
          unit={glucose ? "mg/dL" : ""}
          hint={glucose ? glucose.glucoseContext || timeAgo(glucose.measuredAt) : "Sem registro"}
          tone="green"
        />
        <SummaryCard
          label="Peso"
          value={weight ? String(weight.weightKg).replace(".", ",") : "—"}
          unit={weight ? "kg" : ""}
          hint={weight ? timeAgo(weight.measuredAt) : "Sem registro"}
          tone="violet"
        />
        <SummaryCard
          label="Função renal"
          value="—"
          unit=""
          hint="Via exames da consulta"
          tone="teal"
        />
      </div>

      <Link
        href="/paciente/registrar"
        className="btn-gold mt-4 w-full"
      >
        Registrar dados de hoje
      </Link>

      <p className="mt-8 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
        Próxima consulta
      </p>
      <div className="mt-3">
        {nextBooking ? (
          <div className="panel">
            <p className="text-sm text-[var(--text-muted)]">{formatSlotLabel(nextBooking.slotStart)}</p>
            <p className="mt-1 font-bold text-[var(--text)]">{nextBooking.doctorName}</p>
            {nextBooking.status === "confirmed" ? (
              <Link
                href={`/consulta/${nextBooking.meetingRoomId}`}
                className="btn-gold mt-4 inline-flex"
              >
                Abrir sala da consulta
              </Link>
            ) : (
              <p className="mt-2 text-xs uppercase tracking-wider text-[var(--warn)]">
                {nextBooking.status}
              </p>
            )}
          </div>
        ) : (
          <div className="panel">
            <p className="text-sm text-[var(--text-muted)]">
              Você não tem consulta agendada.
            </p>
            <Link href="/agendar" className="btn-ghost mt-4 inline-flex">
              Agendar consulta
            </Link>
          </div>
        )}
      </div>

      <p className="mt-8 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
        Alimentação recente
      </p>
      <div className="mt-3">
        {food.length > 0 ? (
          <div className="panel space-y-3">
            {food.slice(0, 4).map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="font-semibold text-[var(--text)]">{f.food}</p>
                  {f.meal && <p className="text-xs text-[var(--text-muted)]">{f.meal}</p>}
                </div>
                <span className="text-xs text-[var(--text-muted)]">{timeAgo(f.loggedAt)}</span>
              </div>
            ))}
            <Link href="/paciente/alimentacao" className="text-sm font-semibold text-[var(--gold)]">
              Ver diário alimentar →
            </Link>
          </div>
        ) : (
          <div className="panel">
            <p className="text-sm text-[var(--text-muted)]">
              Nenhum alimento registrado ainda.
            </p>
            <Link href="/paciente/alimentacao" className="btn-ghost mt-4 inline-flex">
              Abrir diário alimentar
            </Link>
          </div>
        )}
      </div>

      <PatientNav />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  hint,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  hint: string;
  tone: "rose" | "green" | "violet" | "teal";
}) {
  const tones: Record<string, string> = {
    rose: "bg-[#fff0ee] text-[#c04b46]",
    green: "bg-[#eaf8f2] text-[#1c8c70]",
    violet: "bg-[#f2edff] text-[#7758c6]",
    teal: "bg-[var(--gold-soft)] text-[var(--gold)]",
  };
  return (
    <div className="rounded-[22px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow)]">
      <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[tone]}`}>
        {label}
      </span>
      <p className="mt-3 text-2xl font-extrabold text-[var(--text)]">
        {value}
        {unit && <span className="ml-1 text-sm font-semibold text-[var(--text-muted)]">{unit}</span>}
      </p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>
    </div>
  );
}
