"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PatientNav } from "@/components/PatientNav";

type Track = { key: string; label: string; unit: string; total: number; goal: number | null; status: "verde" | "amarelo" | "vermelho" | "estimativa"; pct: number | null };
type Entry = { id: string; kind: "alimento" | "liquido"; meal?: string | null; timeLabel?: string | null; food: string; grams?: number | null; volumeMl?: number | null; household?: string | null; nutrients: Record<string, number>; note?: string | null; photoUrl?: string | null };
type Alert = { key: string; status: string; label: string; message: string | null; contributors: { food: string; value: number }[] };
type Goals = { targets: Record<string, number | null>; note?: string | null; nutritionistName?: string | null } | null;
type Food = { id: string; name: string; state?: string; source: string; measure?: string; measureGrams?: number; potassium_mg: number; phosphorus_mg: number; sodium_mg: number };

const LIGHT: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  verde: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Dentro da meta" },
  amarelo: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Próximo do limite" },
  vermelho: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Acima da meta" },
  estimativa: { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400", label: "Estimativa" },
};

export default function PacienteNutricaoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [goals, setGoals] = useState<Goals>(null);
  const [hasGoals, setHasGoals] = useState(false);
  const [date, setDate] = useState("");

  // formulário
  const [kind, setKind] = useState<"alimento" | "liquido">("alimento");
  const [foodQ, setFoodQ] = useState("");
  const [foods, setFoods] = useState<Food[]>([]);
  const [picked, setPicked] = useState<Food | null>(null);
  const [foodName, setFoodName] = useState("");
  const [grams, setGrams] = useState("");
  const [volumeMl, setVolumeMl] = useState("");
  const [meal, setMeal] = useState("");
  const [timeLabel, setTimeLabel] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/patient/nutrition/diary");
    if (res.status === 401) { router.replace("/paciente/entrar"); return; }
    const d = await res.json();
    setEntries(d.entries || []);
    setTracks(d.tracks || []);
    setAlerts(d.alerts || []);
    setGoals(d.goals || null);
    setHasGoals(Boolean(d.hasGoals));
    setDate(d.date || "");
    setLoading(false);
  }, [router]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (kind !== "alimento") return;
    const t = setTimeout(() => {
      fetch(`/api/nutrition/foods?q=${encodeURIComponent(foodQ)}`).then((r) => r.json()).then((d) => setFoods(d.foods || [])).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [foodQ, kind]);

  function pick(f: Food) {
    setPicked(f); setFoodName(f.name + (f.state ? ` (${f.state})` : "")); setGrams(String(f.measureGrams || 100)); setFoodQ("");
  }
  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 800000) { setErr("Foto muito grande (máx. ~800 KB)."); return; }
    const r = new FileReader(); r.onload = () => setPhoto(String(r.result || "")); r.readAsDataURL(f);
  }

  async function add() {
    setSaving(true); setErr("");
    try {
      const body: Record<string, unknown> = { kind, meal, timeLabel, note, photoUrl: photo || undefined };
      if (kind === "alimento") { body.foodId = picked?.id; body.food = foodName; body.grams = grams; }
      else { body.food = foodName || "Água"; body.volumeMl = volumeMl; }
      const res = await fetch("/api/patient/nutrition/diary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Erro");
      setPicked(null); setFoodName(""); setGrams(""); setVolumeMl(""); setMeal(""); setTimeLabel(""); setNote(""); setPhoto("");
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }
  async function del(id: string) {
    await fetch(`/api/patient/nutrition/diary?id=${id}`, { method: "DELETE" });
    await load();
  }

  if (loading) return <div className="mx-auto max-w-2xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Meu diário alimentar</p>
          <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">O que comi e bebi hoje</h1>
        </div>
        <Link href="/paciente/nutricao/educacao" className="btn-ghost text-sm">Entenda sua alimentação →</Link>
      </div>

      {/* Acompanhamento (semáforo) */}
      <section className="mt-4">
        {!hasGoals && (
          <p className="mb-3 rounded-xl border border-[var(--border)] bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Sua nutricionista ainda não definiu metas individuais. Os valores abaixo são apenas uma <b>estimativa educativa</b> —
            não representam uma restrição. Converse com sua equipe para metas personalizadas.
          </p>
        )}
        {goals?.note && (
          <p className="mb-3 rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft)] px-3 py-2 text-sm text-[var(--text)]">
            <b>Orientação da nutricionista:</b> {goals.note}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tracks.map((t) => {
            const l = LIGHT[t.status];
            return (
              <div key={t.key} className={`rounded-2xl border border-[var(--border)] p-3 ${l.bg}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${l.dot}`} />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t.label}</p>
                </div>
                <p className="mt-1 text-lg font-extrabold text-[var(--text)]">{t.total}<span className="text-xs font-normal text-[var(--text-muted)]"> {t.unit}</span></p>
                <p className={`text-[11px] font-semibold ${l.text}`}>{t.goal != null ? `meta ${t.goal} ${t.unit} · ${l.label}` : l.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Alertas educativos */}
      {alerts.length > 0 && (
        <section className="mt-4 space-y-2">
          {alerts.map((a) => (
            <div key={a.key} className={`rounded-xl border px-3 py-2 text-sm ${a.status === "vermelho" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
              <p>{a.message}</p>
              {a.contributors.length > 0 && (
                <p className="mt-1 text-xs opacity-90">Mais contribuíram hoje: {a.contributors.map((c) => c.food).join(", ")}.</p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Registrar */}
      <section className="panel mt-5">
        <div className="flex gap-2">
          {(["alimento", "liquido"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${kind === k ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"}`}>
              {k === "alimento" ? "Alimento" : "Líquido"}
            </button>
          ))}
        </div>

        {kind === "alimento" ? (
          <>
            <div className="mt-3">
              <input className="input-field" placeholder="Buscar alimento (ex.: banana, arroz, feijão)…" value={foodQ} onChange={(e) => setFoodQ(e.target.value)} />
              {foods.length > 0 && foodQ && (
                <div className="mt-1 grid gap-1">
                  {foods.slice(0, 6).map((f) => (
                    <button key={f.id} type="button" onClick={() => pick(f)} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-1.5 text-left text-sm hover:border-[var(--border-gold)]">
                      <span>{f.name} <span className="text-xs text-[var(--text-muted)]">{f.state ? `· ${f.state}` : ""} · K {f.potassium_mg}/P {f.phosphorus_mg}/Na {f.sodium_mg} (100g)</span></span>
                      <span className="text-[var(--gold)]">selecionar</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Alimento</span><input className="input-field" value={foodName} onChange={(e) => { setFoodName(e.target.value); setPicked(null); }} placeholder="Nome do alimento" /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Quantidade (g)</span><input className="input-field" inputMode="numeric" value={grams} onChange={(e) => setGrams(e.target.value)} /></label>
            </div>
            {!picked && foodName && <p className="mt-1 text-xs text-[var(--text-muted)]">Sem alimento do banco selecionado: será registrado sem estimativa de nutrientes.</p>}
          </>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Líquido</span><input className="input-field" value={foodName} onChange={(e) => setFoodName(e.target.value)} placeholder="Água, suco, café…" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Quantidade (mL)</span><input className="input-field" inputMode="numeric" value={volumeMl} onChange={(e) => setVolumeMl(e.target.value)} /></label>
          </div>
        )}

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Refeição</span>
            <select className="input-field" value={meal} onChange={(e) => setMeal(e.target.value)}>
              <option value="">—</option><option>Café da manhã</option><option>Lanche da manhã</option><option>Almoço</option><option>Lanche da tarde</option><option>Jantar</option><option>Ceia</option>
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Horário</span><input className="input-field" value={timeLabel} onChange={(e) => setTimeLabel(e.target.value)} placeholder="Ex.: 12:30" /></label>
        </div>
        <label className="mt-2 block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Observação (opcional)</span><input className="input-field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: sem sal; pouca fome" /></label>
        <div className="mt-2 flex items-center gap-3">
          <label className="btn-ghost cursor-pointer text-sm">{photo ? "Trocar foto" : "Adicionar foto"}<input type="file" accept="image/*" className="hidden" onChange={onPhoto} /></label>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Prato" className="h-12 w-12 rounded-lg border border-[var(--border)] object-cover" />
          )}
        </div>
        {err && <p className="mt-2 text-sm font-semibold text-[var(--danger)]">{err}</p>}
        <button type="button" className="btn-gold mt-3" onClick={add} disabled={saving}>{saving ? "Registrando…" : "Registrar"}</button>
      </section>

      {/* Lista do dia */}
      <section className="mt-5">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Registros de hoje {date && `(${date.split("-").reverse().join("/")})`}</p>
        <div className="mt-2 grid gap-2">
          {entries.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nada registrado ainda hoje.</p>}
          {entries.map((e) => (
            <div key={e.id} className="panel flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {e.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.photoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                ) : null}
                <div>
                  <p className="font-semibold text-[var(--text)]">{e.food} {e.kind === "alimento" && e.grams ? <span className="text-xs font-normal text-[var(--text-muted)]">· {e.grams} g</span> : null}{e.kind === "liquido" && e.volumeMl ? <span className="text-xs font-normal text-[var(--text-muted)]">· {e.volumeMl} mL</span> : null}</p>
                  <p className="text-xs text-[var(--text-muted)]">{[e.meal, e.timeLabel].filter(Boolean).join(" · ")}{e.kind === "alimento" && e.nutrients?.potassium_mg ? ` · K ${e.nutrients.potassium_mg} mg` : ""}</p>
                </div>
              </div>
              <button type="button" className="text-sm text-[var(--danger)]" onClick={() => del(e.id)}>Remover</button>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-6 text-center text-[11px] text-[var(--text-muted)]">Os valores são estimativas com base em tabelas nutricionais (TBCA/TACO). Não substituem a avaliação da sua equipe.</p>
      <PatientNav />
    </div>
  );
}
