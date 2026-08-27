"use client";

import { useCallback, useEffect, useState } from "react";
import { PD_TRAINING_ITEMS, type PdTrainingStatus } from "@/lib/pd-client";

type Alert = { key: string; level: string; title: string; message: string; at: string };
type Bundle = {
  isPd?: boolean;
  alerts?: Alert[];
  profile?: {
    modality?: string | null; startDate?: string | null; implantDate?: string | null;
    catheterType?: string | null; catheterSite?: string | null; caregiver?: string | null; center?: string | null;
  } | null;
  prescriptions?: Record<string, unknown>[];
  logs?: Record<string, unknown>[];
  catheter?: Record<string, unknown>[];
  peritonitis?: Record<string, unknown>[];
  adequacy?: Record<string, unknown>[];
  training?: { evaluatedAt: string; createdByName?: string | null; items: Record<string, PdTrainingStatus>; notes?: string | null }[];
};

type Lab = { key: string; label: string; value: number; unit?: string; measuredAt: string };

const TABS = [
  { id: "geral", label: "Dados gerais" },
  { id: "rx", label: "Prescrição" },
  { id: "controle", label: "Controle" },
  { id: "cateter", label: "Cateter" },
  { id: "peri", label: "Peritonite" },
  { id: "adeq", label: "Adequação" },
  { id: "treino", label: "Treinamento" },
] as const;

function numOrEmpty(v: unknown) { return v == null || v === "" ? "" : String(v); }

export function PdModule({ patientKey, labs = [] }: { patientKey: string; labs?: Lab[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("geral");
  const [data, setData] = useState<Bundle | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({ modality: "CAPD", startDate: "", implantDate: "", catheterType: "", catheterSite: "", caregiver: "", center: "" });
  const [rx, setRx] = useState({ exchangesPerDay: "4", volumeMl: "2000", dwellHours: "4", solution: "Glicose", glucoseConcentration: "1,5%", icodextrin: false, lastFill: "", notes: "" });
  const [daily, setDaily] = useState({ date: new Date().toISOString().slice(0, 10), weightKg: "", systolic: "", diastolic: "", urineMl: "", ultrafiltrationMl: "", drainedVolumeMl: "", balanceMl: "", edema: "", glucose: "", effluentAppearance: "claro", abdominalPain: false, fever: false, missedExchanges: false, occurrences: "" });
  const [cat, setCat] = useState({ date: new Date().toISOString().slice(0, 10), site: "", exitSite: "", hyperemia: false, secretion: false, pain: false, crust: false, dressing: "", notes: "" });
  const [peri, setPeri] = useState({ date: new Date().toISOString().slice(0, 10), symptoms: "", cloudyEffluent: true, abdominalPain: true, cellCount: "", pmn: "", gram: "", culture: "", organism: "", antibiotic: "", route: "", startDate: "", endDate: "", clinicalResponse: "", catheterRemoved: false, recurrenceKind: "", outcome: "" });
  const [adeq, setAdeq] = useState({ date: new Date().toISOString().slice(0, 10), ktv: "", residualClearance: "", residualUrine: "", ultrafiltration: "", pet: "", transporterType: "", notes: "" });
  const [train, setTrain] = useState<Record<string, PdTrainingStatus>>(
    Object.fromEntries(PD_TRAINING_ITEMS.map((i) => [i.key, "pendente"])) as Record<string, PdTrainingStatus>
  );
  const [trainNotes, setTrainNotes] = useState("");

  const load = useCallback(async () => {
    const d = await fetch(`/api/pd/${encodeURIComponent(patientKey)}`).then((r) => r.json());
    setData(d);
    if (d.profile) {
      setProfile({
        modality: d.profile.modality || "CAPD",
        startDate: d.profile.startDate || "",
        implantDate: d.profile.implantDate || "",
        catheterType: d.profile.catheterType || "",
        catheterSite: d.profile.catheterSite || "",
        caregiver: d.profile.caregiver || "",
        center: d.profile.center || "",
      });
    }
  }, [patientKey]);

  useEffect(() => { load(); }, [load]);

  async function post(kind: string, body: Record<string, unknown>) {
    setSaving(true); setMsg("");
    try {
      const res = await fetch(`/api/pd/${encodeURIComponent(patientKey)}/entries`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...body }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não foi possível salvar.");
      setMsg("Registro salvo.");
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  async function saveProfile() {
    setSaving(true); setMsg("");
    try {
      const res = await fetch(`/api/pd/${encodeURIComponent(patientKey)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não foi possível salvar.");
      setMsg("Dados gerais atualizados.");
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  if (data && data.isPd === false) {
    return <p className="text-sm text-[var(--text-muted)]">A diálise peritoneal aparece somente para pacientes com DP marcada no perfil clínico.</p>;
  }

  const lab = (k: string) => labs.find((l) => l.key === k);

  return (
    <div className="space-y-3">
      {(data?.alerts || []).length > 0 && (
        <div className="grid gap-2">
          {data!.alerts!.map((a) => (
            <div key={a.key} className={`rounded-2xl border px-4 py-3 text-sm ${a.level === "alerta" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              <p className="font-bold">{a.title}</p>
              <p>{a.message}</p>
              <p className="mt-1 text-[11px] opacity-70">Alerta interno — não substitui avaliação médica.</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${tab === t.id ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"}`}>{t.label}</button>
        ))}
      </div>

      {tab === "geral" && (
        <div className="panel grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Modalidade</span>
            <select className="input-field" value={profile.modality} onChange={(e) => setProfile({ ...profile, modality: e.target.value })}>
              <option value="CAPD">CAPD</option><option value="APD">APD</option>
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data de início</span><input type="date" className="input-field" value={profile.startDate} onChange={(e) => setProfile({ ...profile, startDate: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data de implante do cateter</span><input type="date" className="input-field" value={profile.implantDate} onChange={(e) => setProfile({ ...profile, implantDate: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Tipo de cateter</span><input className="input-field" value={profile.catheterType} onChange={(e) => setProfile({ ...profile, catheterType: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Local do cateter</span><input className="input-field" value={profile.catheterSite} onChange={(e) => setProfile({ ...profile, catheterSite: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Responsável/cuidador</span><input className="input-field" value={profile.caregiver} onChange={(e) => setProfile({ ...profile, caregiver: e.target.value })} /></label>
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Centro responsável</span><input className="input-field" value={profile.center} onChange={(e) => setProfile({ ...profile, center: e.target.value })} /></label>
          <div className="sm:col-span-2"><button type="button" className="btn-gold" onClick={saveProfile} disabled={saving}>{saving ? "Salvando…" : "Salvar dados gerais"}</button></div>
        </div>
      )}

      {tab === "rx" && (
        <div className="space-y-3">
          <div className="panel grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Número de trocas</span><input className="input-field" value={rx.exchangesPerDay} onChange={(e) => setRx({ ...rx, exchangesPerDay: e.target.value })} inputMode="numeric" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Volume por troca (mL)</span><input className="input-field" value={rx.volumeMl} onChange={(e) => setRx({ ...rx, volumeMl: e.target.value })} inputMode="numeric" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Tempo de permanência (h)</span><input className="input-field" value={rx.dwellHours} onChange={(e) => setRx({ ...rx, dwellHours: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Solução</span><input className="input-field" value={rx.solution} onChange={(e) => setRx({ ...rx, solution: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Concentração de glicose</span><input className="input-field" value={rx.glucoseConcentration} onChange={(e) => setRx({ ...rx, glucoseConcentration: e.target.value })} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={rx.icodextrin} onChange={(e) => setRx({ ...rx, icodextrin: e.target.checked })} /> Icodextrina</label>
            <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Último enchimento</span><input className="input-field" value={rx.lastFill} onChange={(e) => setRx({ ...rx, lastFill: e.target.value })} /></label>
            <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Observações</span><textarea className="input-field min-h-[60px]" value={rx.notes} onChange={(e) => setRx({ ...rx, notes: e.target.value })} /></label>
            <div className="sm:col-span-2"><button type="button" className="btn-gold" onClick={() => post("prescription", rx)} disabled={saving}>{saving ? "Salvando…" : "Registrar prescrição"}</button></div>
          </div>
          {(data?.prescriptions || []).map((p) => (
            <div key={String(p.id)} className="panel text-sm text-[var(--text-soft)]">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{new Date(String(p.createdAt)).toLocaleString("pt-BR")} · {String(p.createdByName || "")}</p>
              <p>{numOrEmpty(p.exchanges)} trocas · {numOrEmpty(p.volumeMl)} mL · {String(p.solution || "")} {String(p.glucosePercent || "")} {p.icodextrin ? "· icodextrina" : ""}</p>
              {p.notes ? <p className="mt-1">{String(p.notes)}</p> : null}
            </div>
          ))}
        </div>
      )}

      {tab === "controle" && (
        <div className="space-y-3">
          <div className="panel grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data</span><input type="date" className="input-field" value={daily.date} onChange={(e) => setDaily({ ...daily, date: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Peso (kg)</span><input className="input-field" value={daily.weightKg} onChange={(e) => setDaily({ ...daily, weightKg: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">PA sistólica</span><input className="input-field" value={daily.systolic} onChange={(e) => setDaily({ ...daily, systolic: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">PA diastólica</span><input className="input-field" value={daily.diastolic} onChange={(e) => setDaily({ ...daily, diastolic: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Diurese (mL)</span><input className="input-field" value={daily.urineMl} onChange={(e) => setDaily({ ...daily, urineMl: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Ultrafiltração (mL)</span><input className="input-field" value={daily.ultrafiltrationMl} onChange={(e) => setDaily({ ...daily, ultrafiltrationMl: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Volume drenado (mL)</span><input className="input-field" value={daily.drainedVolumeMl} onChange={(e) => setDaily({ ...daily, drainedVolumeMl: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Balanço (mL)</span><input className="input-field" value={daily.balanceMl} onChange={(e) => setDaily({ ...daily, balanceMl: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Edema</span><input className="input-field" value={daily.edema} onChange={(e) => setDaily({ ...daily, edema: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Glicemia</span><input className="input-field" value={daily.glucose} onChange={(e) => setDaily({ ...daily, glucose: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Aspecto do efluente</span>
              <select className="input-field" value={daily.effluentAppearance} onChange={(e) => setDaily({ ...daily, effluentAppearance: e.target.value })}>
                <option value="claro">Claro</option><option value="turvo">Turvo</option><option value="sanguinolento">Sanguinolento</option><option value="fibrina">Fibrina</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={daily.abdominalPain} onChange={(e) => setDaily({ ...daily, abdominalPain: e.target.checked })} /> Dor abdominal</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={daily.fever} onChange={(e) => setDaily({ ...daily, fever: e.target.checked })} /> Febre</label>
            <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" checked={daily.missedExchanges} onChange={(e) => setDaily({ ...daily, missedExchanges: e.target.checked })} /> Paciente deixou de realizar trocas</label>
            <label className="block sm:col-span-3"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Intercorrências</span><textarea className="input-field min-h-[60px]" value={daily.occurrences} onChange={(e) => setDaily({ ...daily, occurrences: e.target.value })} /></label>
            <div className="sm:col-span-3"><button type="button" className="btn-gold" onClick={() => post("daily", daily)} disabled={saving}>{saving ? "Salvando…" : "Registrar controle"}</button></div>
          </div>
          {(data?.logs || []).map((l) => (
            <div key={String(l.id)} className="panel text-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{new Date(String(l.loggedAt || l.createdAt)).toLocaleString("pt-BR")} · {String(l.createdByName || "")}</p>
              <p className="text-[var(--text-soft)]">Peso {numOrEmpty(l.weightKg) || "—"} kg · PA {numOrEmpty(l.systolic)}/{numOrEmpty(l.diastolic)} · UF {numOrEmpty(l.ultrafiltrationMl)} mL · efluente {String(l.effluent || "—")}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "cateter" && (
        <div className="space-y-3">
          <div className="panel grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data</span><input type="date" className="input-field" value={cat.date} onChange={(e) => setCat({ ...cat, date: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Local</span><input className="input-field" value={cat.site} onChange={(e) => setCat({ ...cat, site: e.target.value })} /></label>
            <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Avaliação do orifício de saída</span><input className="input-field" value={cat.exitSite} onChange={(e) => setCat({ ...cat, exitSite: e.target.value })} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cat.hyperemia} onChange={(e) => setCat({ ...cat, hyperemia: e.target.checked })} /> Hiperemia</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cat.secretion} onChange={(e) => setCat({ ...cat, secretion: e.target.checked })} /> Secreção</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cat.pain} onChange={(e) => setCat({ ...cat, pain: e.target.checked })} /> Dor</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cat.crust} onChange={(e) => setCat({ ...cat, crust: e.target.checked })} /> Crosta</label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Curativo</span><input className="input-field" value={cat.dressing} onChange={(e) => setCat({ ...cat, dressing: e.target.value })} /></label>
            <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Observações</span><textarea className="input-field min-h-[60px]" value={cat.notes} onChange={(e) => setCat({ ...cat, notes: e.target.value })} /></label>
            <p className="sm:col-span-2 text-xs text-[var(--text-muted)]">Foto do orifício ficará disponível em uma versão futura.</p>
            <div className="sm:col-span-2"><button type="button" className="btn-gold" onClick={() => post("catheter", cat)} disabled={saving}>{saving ? "Salvando…" : "Registrar avaliação do cateter"}</button></div>
          </div>
          {(data?.catheter || []).map((c) => (
            <div key={String(c.id)} className="panel text-sm text-[var(--text-soft)]">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{String(c.evaluatedAt)} · {String(c.createdByName || "")}</p>
              <p>{[c.hyperemia && "hiperemia", c.secretion && "secreção", c.pain && "dor", c.crust && "crosta"].filter(Boolean).join(" · ") || "sem sinais"} {c.notes ? `— ${c.notes}` : ""}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "peri" && (
        <div className="space-y-3">
          <div className="panel grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data</span><input type="date" className="input-field" value={peri.date} onChange={(e) => setPeri({ ...peri, date: e.target.value })} /></label>
            <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Sintomas</span><input className="input-field" value={peri.symptoms} onChange={(e) => setPeri({ ...peri, symptoms: e.target.value })} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={peri.cloudyEffluent} onChange={(e) => setPeri({ ...peri, cloudyEffluent: e.target.checked })} /> Efluente turvo</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={peri.abdominalPain} onChange={(e) => setPeri({ ...peri, abdominalPain: e.target.checked })} /> Dor abdominal</label>
            {(["cellCount", "pmn", "gram", "culture", "organism", "antibiotic", "route", "startDate", "endDate", "clinicalResponse", "recurrenceKind", "outcome"] as const).map((k) => (
              <label key={k} className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{
                  { cellCount: "Contagem celular", pmn: "PMN", gram: "Gram", culture: "Cultura", organism: "Micro-organismo", antibiotic: "Antibioticoterapia", route: "Via", startDate: "Início da ATB", endDate: "Término da ATB", clinicalResponse: "Resposta clínica", recurrenceKind: "Recorrência/recaída/repetição", outcome: "Desfecho" }[k]
                }</span>
                <input className={k.includes("Date") ? "input-field" : "input-field"} type={k.includes("Date") ? "date" : "text"} value={peri[k]} onChange={(e) => setPeri({ ...peri, [k]: e.target.value })} />
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={peri.catheterRemoved} onChange={(e) => setPeri({ ...peri, catheterRemoved: e.target.checked })} /> Retirada de cateter</label>
            <div className="sm:col-span-2"><button type="button" className="btn-gold" onClick={() => post("peritonitis", peri)} disabled={saving}>{saving ? "Salvando…" : "Registrar episódio"}</button></div>
          </div>
          {(data?.peritonitis || []).map((p) => (
            <div key={String(p.id)} className="panel text-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{String(p.onsetDate)} · {String(p.createdByName || "")}</p>
              <p className="text-[var(--text-soft)]">{String(p.organism || p.symptoms || "Episódio")} · {String(p.outcome || "")}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "adeq" && (
        <div className="space-y-3">
          <div className="panel">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Exames já cadastrados (não duplicar)</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["albumina", "Albumina"], ["potassio", "Potássio"], ["calcio", "Cálcio"], ["fosforo", "Fósforo"],
                ["pth", "PTH"], ["hemoglobina", "Hemoglobina"], ["tfge", "TFGe"],
              ].map(([k, label]) => {
                const x = lab(k);
                return (
                  <div key={k} className="rounded-xl border border-[var(--border)] p-2">
                    <p className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">{label}</p>
                    <p className="text-sm font-bold">{x ? `${x.value} ${x.unit || ""}` : "—"}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="panel grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data</span><input type="date" className="input-field" value={adeq.date} onChange={(e) => setAdeq({ ...adeq, date: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Kt/V</span><input className="input-field" value={adeq.ktv} onChange={(e) => setAdeq({ ...adeq, ktv: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Clearance residual</span><input className="input-field" value={adeq.residualClearance} onChange={(e) => setAdeq({ ...adeq, residualClearance: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Diurese residual</span><input className="input-field" value={adeq.residualUrine} onChange={(e) => setAdeq({ ...adeq, residualUrine: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Ultrafiltração</span><input className="input-field" value={adeq.ultrafiltration} onChange={(e) => setAdeq({ ...adeq, ultrafiltration: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">PET</span><input className="input-field" value={adeq.pet} onChange={(e) => setAdeq({ ...adeq, pet: e.target.value })} /></label>
            <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Tipo de transportador</span><input className="input-field" value={adeq.transporterType} onChange={(e) => setAdeq({ ...adeq, transporterType: e.target.value })} /></label>
            <div className="sm:col-span-2"><button type="button" className="btn-gold" onClick={() => post("adequacy", adeq)} disabled={saving}>{saving ? "Salvando…" : "Registrar adequação"}</button></div>
          </div>
          {(data?.adequacy || []).map((a) => (
            <div key={String(a.id)} className="panel text-sm text-[var(--text-soft)]">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{String(a.measuredAt)} · {String(a.createdByName || "")}</p>
              <p>Kt/V {numOrEmpty(a.ktv) || "—"} · PET {String(a.pet || "—")} · {String(a.transporter || "")}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "treino" && (
        <div className="space-y-3">
          <div className="panel space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Checklist de enfermagem</p>
            {PD_TRAINING_ITEMS.map((item) => (
              <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] py-2 last:border-0">
                <span className="text-sm text-[var(--text)]">{item.label}</span>
                <select className="input-field w-auto" value={train[item.key]} onChange={(e) => setTrain({ ...train, [item.key]: e.target.value as PdTrainingStatus })}>
                  <option value="treinado">Treinado</option>
                  <option value="reforco">Necessita reforço</option>
                  <option value="pendente">Pendente</option>
                </select>
              </div>
            ))}
            <textarea className="input-field min-h-[60px]" placeholder="Observações" value={trainNotes} onChange={(e) => setTrainNotes(e.target.value)} />
            <button type="button" className="btn-gold" onClick={() => post("training", { items: train, notes: trainNotes })} disabled={saving}>{saving ? "Salvando…" : "Registrar avaliação"}</button>
          </div>
          {(data?.training || []).map((t, i) => (
            <div key={i} className="panel text-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{t.evaluatedAt} · {t.createdByName || ""}</p>
              <p className="text-[var(--text-muted)]">{PD_TRAINING_ITEMS.filter((x) => t.items?.[x.key] === "pendente").length} pendente(s) · {PD_TRAINING_ITEMS.filter((x) => t.items?.[x.key] === "reforco").length} reforço</p>
            </div>
          ))}
        </div>
      )}

      {msg && <p className="text-sm font-semibold text-[var(--text-soft)]">{msg}</p>}
    </div>
  );
}
