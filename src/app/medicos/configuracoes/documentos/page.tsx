"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";

type Area = {
  marginTop: number; marginBottom: number; marginLeft: number; marginRight: number;
  repeat: "all" | "first" | "simplified"; showPatientHeader: boolean; showSignature: boolean;
};
type Letterhead = {
  id: string; name: string; kind: "pdf" | "image"; mime?: string | null;
  isDefault: boolean; active: boolean; area: Area; createdAt: string; fileUrl: string;
};

export default function MeusPapeisTimbradosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Letterhead[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const auth = await fetch("/api/auth").then((r) => r.json());
    if (!auth.doctor) { router.replace("/medicos/login"); return; }
    const r = await fetch("/api/doctor/letterheads").then((x) => x.json());
    setItems(r.letterheads || []);
    setLoading(false);
    if (!selected && r.letterheads?.length) setSelected(r.letterheads[0].id);
  }, [router, selected]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setMsg("Escolha um arquivo PDF, PNG ou JPG."); return; }
    setUploading(true); setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", name.trim());
    const res = await fetch("/api/doctor/letterheads", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg(d.error || "Falha no upload."); return; }
    setName(""); if (fileRef.current) fileRef.current.value = "";
    const created = await res.json();
    await load();
    setSelected(created.id);
  }

  const current = items.find((l) => l.id === selected) || null;

  async function saveArea(area: Area) {
    if (!current) return;
    setItems((xs) => xs.map((l) => (l.id === current.id ? { ...l, area } : l)));
    await fetch(`/api/doctor/letterheads/${current.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ area }),
    });
  }
  async function setDefault(id: string) {
    await fetch(`/api/doctor/letterheads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setDefault: true }) });
    load();
  }
  async function rename(id: string, newName: string) {
    await fetch(`/api/doctor/letterheads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName }) });
    load();
  }
  async function toggleActive(l: Letterhead) {
    await fetch(`/api/doctor/letterheads/${l.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !l.active }) });
    load();
  }
  async function remove(id: string) {
    if (!window.confirm("Excluir este papel timbrado?")) return;
    await fetch(`/api/doctor/letterheads/${id}`, { method: "DELETE" });
    setSelected(null); load();
  }

  if (loading) return <div className="mx-auto max-w-5xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-5xl px-5 pb-28 pt-8 lg:pb-8">
          <Link href="/medicos/configuracoes" className="text-sm font-semibold text-[var(--gold)]">← Configurações</Link>
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Meus papéis timbrados</h1>
          <p className="mt-1 text-[var(--text-muted)]">
            Envie seu próprio receituário (PDF, PNG ou JPG). Ele vira o <strong>fundo</strong> dos documentos — o sistema escreve o conteúdo na área que você definir. A plataforma não altera sua identidade.
          </p>

          <form onSubmit={upload} className="panel mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Arquivo (PDF, PNG ou JPG)</span>
              <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="input-field" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome do modelo</span>
              <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Receituário Dr. Juno" />
            </label>
            <button type="submit" className="btn-gold" disabled={uploading}>{uploading ? "Enviando…" : "+ Adicionar"}</button>
          </form>
          {msg && <p className="mt-2 text-sm font-semibold text-[var(--danger)]">{msg}</p>}

          {items.length === 0 ? (
            <p className="panel mt-6 text-[var(--text-muted)]">Nenhum papel timbrado ainda. Envie o primeiro acima.</p>
          ) : (
            <div className="mt-6 grid gap-5 lg:grid-cols-[280px_1fr]">
              {/* Lista */}
              <div className="grid gap-2">
                {items.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSelected(l.id)}
                    className={`panel text-left transition ${selected === l.id ? "border-[var(--gold)]" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--text)]">{l.name}</span>
                      {l.isDefault && <span className="rounded-full bg-[var(--gold-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--gold)]">Padrão</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span className="uppercase">{l.kind}</span>
                      <span className={`rounded-full px-2 py-0.5 ${l.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{l.active ? "Ativo" : "Inativo"}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Editor de área útil */}
              {current && <AreaEditor key={current.id} lh={current} onSave={saveArea} onDefault={() => setDefault(current.id)} onRename={(n) => rename(current.id, n)} onToggle={() => toggleActive(current)} onDelete={() => remove(current.id)} />}
            </div>
          )}
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}

function AreaEditor({ lh, onSave, onDefault, onRename, onToggle, onDelete }: {
  lh: Letterhead; onSave: (a: Area) => void; onDefault: () => void; onRename: (n: string) => void; onToggle: () => void; onDelete: () => void;
}) {
  const [area, setArea] = useState<Area>(lh.area);
  const [name, setName] = useState(lh.name);
  useEffect(() => { setArea(lh.area); setName(lh.name); }, [lh]);

  function set<K extends keyof Area>(k: K, v: Area[K]) { setArea((a) => ({ ...a, [k]: v })); }
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

  return (
    <div className="panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input className="input-field max-w-xs" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== lh.name && onRename(name.trim())} />
        <div className="flex flex-wrap gap-2">
          {!lh.isDefault && <button type="button" className="btn-ghost text-sm" onClick={onDefault}>Definir padrão</button>}
          <button type="button" className="btn-ghost text-sm" onClick={onToggle}>{lh.active ? "Desativar" : "Ativar"}</button>
          <button type="button" className="btn-ghost text-sm text-[var(--danger)]" onClick={onDelete}>Excluir</button>
        </div>
      </div>

      <p className="mt-3 text-sm text-[var(--text-muted)]">Área útil (onde o sistema escreve). Ajuste as margens para não escrever sobre logo/cabeçalho/rodapé.</p>

      {/* Preview com overlay da área útil */}
      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,340px)_1fr]">
        <div className="relative mx-auto w-full max-w-[340px]" style={{ aspectRatio: "1 / 1.414" }}>
          <div className="absolute inset-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white">
            {lh.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lh.fileUrl} alt={lh.name} className="h-full w-full object-contain" />
            ) : (
              <iframe src={`${lh.fileUrl}#toolbar=0&navpanes=0&view=Fit`} title={lh.name} className="h-full w-full" />
            )}
          </div>
          {/* retângulo da área útil */}
          <div
            className="pointer-events-none absolute rounded-md border-2 border-dashed border-[var(--gold)] bg-[var(--gold)]/5"
            style={{ top: pct(area.marginTop), bottom: pct(area.marginBottom), left: pct(area.marginLeft), right: pct(area.marginRight) }}
          >
            <span className="absolute left-1 top-1 rounded bg-[var(--gold)] px-1.5 py-0.5 text-[10px] font-bold text-white">área útil</span>
          </div>
        </div>

        <div className="grid gap-3">
          <Slider label={`Margem superior — ${pct(area.marginTop)}`} value={area.marginTop} onChange={(v) => set("marginTop", v)} />
          <Slider label={`Margem inferior — ${pct(area.marginBottom)}`} value={area.marginBottom} onChange={(v) => set("marginBottom", v)} />
          <Slider label={`Margem esquerda — ${pct(area.marginLeft)}`} value={area.marginLeft} onChange={(v) => set("marginLeft", v)} />
          <Slider label={`Margem direita — ${pct(area.marginRight)}`} value={area.marginRight} onChange={(v) => set("marginRight", v)} />

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Timbrado nas páginas</span>
            <select className="input-field" value={area.repeat} onChange={(e) => set("repeat", e.target.value as Area["repeat"])}>
              <option value="all">Repetir em todas as páginas</option>
              <option value="first">Somente na primeira página</option>
              <option value="simplified">Simplificado nas páginas seguintes</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--text)]">
            <input type="checkbox" checked={area.showPatientHeader} onChange={(e) => set("showPatientHeader", e.target.checked)} /> Mostrar cabeçalho do paciente (nome/CPF/data)
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--text)]">
            <input type="checkbox" checked={area.showSignature} onChange={(e) => set("showSignature", e.target.checked)} /> Mostrar bloco de assinatura
          </label>
          <button type="button" className="btn-gold mt-1 w-fit" onClick={() => onSave(area)}>Salvar configuração da área</button>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
      <input type="range" min={0} max={0.45} step={0.005} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--gold)]" />
    </label>
  );
}
