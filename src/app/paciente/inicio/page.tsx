"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PatientNav } from "@/components/PatientNav";
import { ConsentGate } from "@/components/ConsentGate";
import { NotificationBell } from "@/components/NotificationBell";
import { EnableNotifications } from "@/components/EnableNotifications";
import { LabChart } from "@/components/LabChart";
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

type SharedNote = {
  id: string;
  doctorName: string;
  history?: string | null;
  assessment?: string | null;
  plan?: string | null;
  createdAt: string;
};

type SharedDoc = {
  id: string;
  type: "receita" | "exame" | "relatorio";
  title: string;
  createdAt: string;
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
  const [notes, setNotes] = useState<SharedNote[]>([]);
  const [documents, setDocuments] = useState<SharedDoc[]>([]);
  const [labs, setLabs] = useState<{ testKey: string; value: number; unit?: string | null; measuredAt: string }[]>([]);
  const [patientName, setPatientName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [consentPending, setConsentPending] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/patient/records");
    if (res.status === 401) {
      router.replace("/paciente/entrar");
      return;
    }
    // 1º acesso: se ainda precisa criar senha pessoal, envia para a troca obrigatória.
    try {
      const me = await fetch("/api/patient/me").then((r) => (r.ok ? r.json() : null));
      if (me?.mustChangePassword) {
        router.replace("/paciente/senha?primeiro=1&next=/paciente/inicio");
        return;
      }
    } catch {
      /* segue mesmo se a checagem falhar */
    }
    const data = await res.json();
    setEmail(data.email || "");

    if (data.email) {
      try {
        const cRes = await fetch(`/api/consent/status?email=${encodeURIComponent(data.email)}`);
        const cData = await cRes.json();
        if (cData.needsConsent) {
          setConsentPending(true);
          setLoading(false);
          return;
        }
        setConsentPending(false);
      } catch {
        /* segue mesmo se a checagem falhar */
      }
    }
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
      try {
        const n = await fetch("/api/patient/notes");
        const nd = await n.json();
        setNotes(nd.notes || []);
      } catch {
        /* ignore */
      }
      try {
        const dres = await fetch("/api/patient/documents");
        const dd = await dres.json();
        setDocuments(dd.documents || []);
      } catch {
        /* ignore */
      }
      try {
        const lr = await fetch("/api/patient/labs");
        const ld = await lr.json();
        setLabs(ld.labs || []);
      } catch {
        /* ignore */
      }
      try {
        const me = await fetch("/api/patient/me");
        const md = await me.json();
        if (md.found && md.patient?.name) setPatientName(md.patient.name);
        if (md.found && md.patient?.photoUrl) setPhotoUrl(md.patient.photoUrl);
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
  const name = patientName || (email.includes("@") ? email.split("@")[0] : "paciente");

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

  if (consentPending) {
    return (
      <ConsentGate
        email={email}
        onAccepted={() => {
          setConsentPending(false);
          setLoading(true);
          load();
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[560px] px-5 pb-28 pt-8">
      <EnableNotifications />
      <div className="flex items-center gap-3">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="Sua foto" className="h-12 w-12 shrink-0 rounded-full border border-[var(--border)] object-cover" />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--gold-soft)] text-base font-bold text-[var(--gold)]">{(name || "P").slice(0, 2).toUpperCase()}</span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-xl font-extrabold capitalize leading-tight text-[var(--text)] sm:text-2xl">
            Olá, {name}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">Como você está hoje?</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />
          <button
            type="button"
            onClick={logout}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]"
          >
            Sair
          </button>
        </div>
      </div>

      {/* Atalhos secundários — linha rolável no celular */}
      <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link href="/paciente/documentos" className="shrink-0 whitespace-nowrap rounded-full border border-[var(--border)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--text-soft)]">Documentos</Link>
        <Link href="/paciente/dados" className="shrink-0 whitespace-nowrap rounded-full border border-[var(--border)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--text-soft)]">Meus dados</Link>
        <Link href="/paciente/senha" className="shrink-0 whitespace-nowrap rounded-full border border-[var(--border)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--text-soft)]">Trocar senha</Link>
      </nav>

      <KidneyNumbers labs={labs} />

      <EvolutionCharts labs={labs} records={records} />

      <AcessosRapidos />

      <CareTimeline
        bookings={bookings}
        notes={notes}
        documents={documents}
        labs={labs}
        records={records}
        nextBooking={nextBooking}
      />

      <p className="mt-6 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
        Resumo do dia
      </p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        Informação registrada pelo paciente — não substitui evolução médica.
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
              <>
                <p className="mt-2 text-xs uppercase tracking-wider text-[var(--warn)]">
                  {nextBooking.status === "paid"
                    ? "Aguardando confirmação do médico"
                    : nextBooking.status === "pending_payment"
                      ? "Aguardando pagamento"
                      : nextBooking.status}
                </p>
                <Link href="/minhas-consultas" className="mt-2 inline-block text-sm font-semibold text-[var(--gold)]">
                  Ver detalhes / responder
                </Link>
              </>
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

      {documents.length > 0 && (
        <>
          <p className="mt-8 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
            Documentos do seu médico
          </p>
          <div className="mt-3 space-y-3">
            {documents.slice(0, 5).map((d) => (
              <a
                key={d.id}
                href={`/documento/${d.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="panel flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-semibold text-[var(--text)]">{d.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {d.type === "receita" ? "Receita" : d.type === "exame" ? "Pedido de exame" : "Relatório"}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[var(--gold)]">Abrir PDF →</span>
              </a>
            ))}
          </div>
        </>
      )}

      {notes.length > 0 && (
        <>
          <p className="mt-8 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
            Orientações do seu médico
          </p>
          <div className="mt-3 space-y-3">
            {notes.slice(0, 3).map((n) => (
              <div key={n.id} className="panel">
                <p className="text-xs text-[var(--text-muted)]">{n.doctorName}</p>
                {n.history && <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-soft)]">{n.history}</p>}
                {n.assessment && <p className="mt-1 text-sm text-[var(--text-soft)]"><b>Avaliação:</b> {n.assessment}</p>}
                {n.plan && <p className="mt-1 text-sm text-[var(--text-soft)]"><b>Orientações:</b> {n.plan}</p>}
              </div>
            ))}
          </div>
        </>
      )}

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

type Lab = { testKey: string; value: number; unit?: string | null; measuredAt: string };
const KIDNEY_KEYS: { key: string; label: string; edu: string }[] = [
  { key: "tfge", label: "Taxa de filtração (TFGe)", edu: "tfge" },
  { key: "creatinina", label: "Creatinina", edu: "creatinina" },
  { key: "rac", label: "Proteína/albumina na urina (RAC)", edu: "proteina-urina" },
  { key: "potassio", label: "Potássio", edu: "numeros" },
];
function fmtNum(n: number): string {
  return String(n).replace(".", ",");
}
function KidneyNumbers({ labs }: { labs: Lab[] }) {
  const rows = KIDNEY_KEYS.map(({ key, label, edu }) => {
    const series = labs.filter((l) => l.testKey === key).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
    const last = series[series.length - 1];
    const prev = series[series.length - 2];
    let trend = "";
    if (last && prev) {
      if (key === "tfge") trend = last.value > prev.value ? "tendência de melhora" : last.value < prev.value ? "tendência de queda" : "estável";
      else trend = last.value < prev.value ? "reduziu" : last.value > prev.value ? "subiu" : "estável";
    }
    return { key, label, edu, last, prev, trend };
  }).filter((r) => r.last);

  return (
    <>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Meu Rim Hoje</p>
        <Link href="/paciente/entender" className="text-xs font-semibold text-[var(--gold)]">Entender meu rim →</Link>
      </div>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        Números educativos. Não representam diagnóstico automático.
      </p>
      {rows.length === 0 ? (
        <div className="mt-3 rounded-[20px] border border-[var(--border-gold)] bg-[var(--gold-soft)] p-4 text-sm text-[var(--text-soft)]">
          Seus exames de rim aparecerão aqui quando forem registrados. Enquanto isso,{" "}
          <Link href="/paciente/entender" className="font-semibold text-[var(--gold)]">entenda como os rins funcionam</Link>.
        </div>
      ) : (
        <div className="mt-3 grid gap-2">
          {rows.map((r) => (
            <div key={r.key} className="rounded-[18px] border border-[var(--border)] bg-white p-3 shadow-[var(--shadow)]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[var(--text-soft)]">{r.label}</span>
                <span className="text-lg font-extrabold text-[var(--text)]">
                  {fmtNum(r.last!.value)}{r.last!.unit ? <span className="ml-1 text-xs font-semibold text-[var(--text-muted)]">{r.last!.unit}</span> : null}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--text-muted)]">
                  {r.prev ? `anterior: ${fmtNum(r.prev.value)} · ${r.trend}` : new Date(r.last!.measuredAt).toLocaleDateString("pt-BR")}
                </span>
                <Link href={`/paciente/entender#${r.edu}`} className="text-xs font-semibold text-[var(--gold)]">O que isso significa?</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

type TimelineItem = { at: string; title: string; detail?: string; source: "medico" | "paciente" | "sistema" };

function CareTimeline({
  bookings,
  notes,
  documents,
  labs,
  records,
  nextBooking,
}: {
  bookings: Booking[];
  notes: SharedNote[];
  documents: SharedDoc[];
  labs: Lab[];
  records: HomeRecord[];
  nextBooking?: Booking;
}) {
  const items: TimelineItem[] = [];

  for (const b of bookings) {
    items.push({
      at: b.slotStart,
      title: "Consulta nefrológica",
      detail: b.doctorName,
      source: "sistema",
    });
  }
  for (const n of notes) {
    items.push({
      at: n.createdAt,
      title: "Orientação / evolução liberada",
      detail: n.doctorName,
      source: "medico",
    });
  }
  for (const d of documents) {
    const label =
      d.type === "receita" ? "Receita" : d.type === "exame" ? "Pedido de exames" : "Relatório";
    items.push({
      at: d.createdAt,
      title: label,
      detail: d.title,
      source: "medico",
    });
  }
  for (const l of labs) {
    const name =
      l.testKey === "creatinina"
        ? "Creatinina no histórico"
        : l.testKey === "tfge"
          ? "TFGe no histórico"
          : l.testKey === "rac"
            ? "Proteinúria/RAC no histórico"
            : `Exame ${l.testKey}`;
    items.push({
      at: l.measuredAt,
      title: name,
      detail: `${fmtNum(l.value)}${l.unit ? ` ${l.unit}` : ""}`,
      source: "sistema",
    });
  }
  for (const r of records.filter((x) => x.kind !== "symptom").slice(0, 8)) {
    items.push({
      at: r.measuredAt,
      title:
        r.kind === "bp"
          ? "Pressão registrada pelo paciente"
          : r.kind === "glucose"
            ? "Glicemia registrada pelo paciente"
            : "Peso registrado pelo paciente",
      detail:
        r.kind === "bp"
          ? `${r.systolic}/${r.diastolic} mmHg`
          : r.kind === "glucose"
            ? `${r.glucoseMgDl} mg/dL`
            : `${r.weightKg} kg`,
      source: "paciente",
    });
  }

  items.sort((a, b) => a.at.localeCompare(b.at));
  const recent = items.slice(-8);
  if (recent.length === 0 && !nextBooking) return null;

  return (
    <div className="mt-8">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
        Minha jornada renal
      </p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        Consulta → exames → resultados → acompanhamento → retorno
      </p>
      <div className="mt-3 space-y-0">
        {recent.map((it, idx) => (
          <div key={`${it.at}-${it.title}-${idx}`} className="relative flex gap-3 pb-4 last:pb-0">
            <div className="flex w-4 flex-col items-center">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--gold)]" />
              {idx < recent.length - 1 && <span className="mt-1 w-px flex-1 bg-[var(--border)]" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[var(--text-muted)]">
                {new Date(it.at).toLocaleDateString("pt-BR")}
                {it.source === "paciente" ? " · registrado pelo paciente" : ""}
              </p>
              <p className="font-semibold text-[var(--text)]">{it.title}</p>
              {it.detail && <p className="text-sm text-[var(--text-soft)]">{it.detail}</p>}
            </div>
          </div>
        ))}
        {nextBooking && (
          <div className="relative flex gap-3">
            <div className="flex w-4 flex-col items-center">
              <span className="mt-1 h-2.5 w-2.5 rounded-full border-2 border-[var(--gold)] bg-white" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Próximo retorno</p>
              <p className="font-semibold text-[var(--text)]">
                {new Date(nextBooking.slotStart).toLocaleDateString("pt-BR")} · {nextBooking.doctorName}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// "Minha Evolução" — gráficos a partir dos dados JÁ existentes (labs + registros).
// Não cria dados: só desenha séries que têm 2+ pontos.
function EvolutionCharts({ labs, records }: { labs: Lab[]; records: HomeRecord[] }) {
  const labSeries = (key: string) =>
    labs.filter((l) => l.testKey === key).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)).map((l) => ({ x: l.measuredAt, y: l.value }));
  const recSeries = (kind: HomeRecord["kind"], pick: (r: HomeRecord) => number | null | undefined) =>
    records
      .filter((r) => r.kind === kind)
      .slice()
      .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
      .map((r) => ({ x: r.measuredAt, y: Number(pick(r)) }))
      .filter((p) => Number.isFinite(p.y));

  const charts: { title: string; unit?: string; color: string; points: { x: string; y: number }[] }[] = [
    { title: "Função renal (TFGe)", unit: "mL/min", color: "var(--gold)", points: labSeries("tfge") },
    { title: "RAC / Proteinúria", unit: "mg/g", color: "#1a9a78", points: labSeries("rac") },
    { title: "Pressão arterial (sistólica)", unit: "mmHg", color: "#c04b46", points: recSeries("bp", (r) => r.systolic) },
    { title: "Peso", unit: "kg", color: "#7758c6", points: recSeries("weight", (r) => r.weightKg) },
    { title: "Glicemia", unit: "mg/dL", color: "#2b7fb0", points: recSeries("glucose", (r) => r.glucoseMgDl) },
  ].filter((c) => c.points.length >= 2);

  if (charts.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Minha evolução</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">Como seus números vêm mudando ao longo do tempo.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {charts.map((c) => (
          <div key={c.title} className="rounded-[18px] border border-[var(--border)] bg-white p-3 shadow-[var(--shadow)]">
            <p className="text-sm font-semibold text-[var(--text-soft)]">{c.title}</p>
            <LabChart points={c.points} color={c.color} unit={c.unit} />
          </div>
        ))}
      </div>
    </div>
  );
}

// "Acessos rápidos" — atalhos para áreas que JÁ existem (sem novas funções).
function AcessosRapidos() {
  const items: { href: string; label: string; icon: string }[] = [
    { href: "/paciente/exames", label: "Exames", icon: "🧪" },
    { href: "/paciente/documentos", label: "Documentos", icon: "📄" },
    { href: "/paciente/nutricao", label: "Nutrição", icon: "🥗" },
    { href: "/paciente/entender", label: "Entender", icon: "📖" },
    { href: "/minhas-consultas", label: "Consultas", icon: "📅" },
    { href: "/paciente/registrar", label: "Registrar", icon: "➕" },
  ];
  return (
    <div className="mt-6">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Acessos rápidos</p>
      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--border)] bg-white py-3 text-center transition hover:border-[var(--border-gold)] hover:bg-[var(--gold-soft)]">
            <span className="text-xl" aria-hidden>{it.icon}</span>
            <span className="text-[11px] font-semibold text-[var(--text-soft)]">{it.label}</span>
          </Link>
        ))}
      </div>
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
