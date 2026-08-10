"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";

type Lh = {
  id: string;
  name: string;
  mime: string;
  fileName?: string | null;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  fields: Record<string, { x: number; y: number; w?: number }>;
  pageMode: "all" | "first" | "simplified";
  isDefault: boolean;
  active: boolean;
  previewData?: string | null;
};

const FIELD_KEYS = [
  { id: "paciente", label: "PACIENTE" },
  { id: "cpf", label: "CPF" },
  { id: "data", label: "DATA" },
  { id: "idade", label: "IDADE" },
  { id: "assinatura", label: "ASSINATURA" },
  { id: "qrcode", label: "QR CODE" },
] as const;

export default function PapeisTimbradosPage() {
  const router = useRouter();
  const [list, setList] = useState<Lh[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Lh | null>(null);
  const [fullFile, setFullFile] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [dragField, setDragField] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const auth = await fetch("/api/auth").then((r) => r.json());
    if (!auth.doctor) {
      router.replace("/medicos/login");
      return;
    }
    const res = await fetch("/api/doctor/letterheads");
    const data = await res.json();
    setList(data.letterheads || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function openEdit(lh: Lh) {
    setErr("");
    setMsg("");
    setEditing(lh);
    const res = await fetch(`/api/doctor/letterheads/${lh.id}`);
    const data = await res.json();
    if (res.ok) {
      setFullFile(data.letterhead.fileData);
      setEditing({
        ...lh,
        ...data.letterhead,
        previewData: data.letterhead.mime?.startsWith("image/") ? data.letterhead.fileData : lh.previewData,
      });
    }
  }

  async function onUpload(file: File) {
    setErr("");
    setMsg("");
    if (!file) return;
    const ok =
      file.type === "application/pdf" ||
      file.type === "image/png" ||
      file.type === "image/jpeg" ||
      file.type === "image/webp" ||
      /\.(pdf|png|jpe?g|webp)$/i.test(file.name);
    if (!ok) {
      setErr("Envie PDF, PNG, JPG ou WEBP.");
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      setErr("Arquivo muito grande (máx. ~2,5 MB).");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      const res = await fetch("/api/doctor/letterheads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim() || file.name.replace(/\.[^.]+$/, "") || "Meu receituário",
          fileData: dataUrl,
          mime: file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
          fileName: file.name,
          isDefault: list.length === 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no upload");
      setNewName("");
      setMsg("Papel timbrado adicionado. Configure a área útil.");
      await load();
      if (data.letterhead) await openEdit(data.letterhead);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveConfig() {
    if (!editing) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/doctor/letterheads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          name: editing.name,
          marginTop: editing.marginTop,
          marginBottom: editing.marginBottom,
          marginLeft: editing.marginLeft,
          marginRight: editing.marginRight,
          fields: editing.fields,
          pageMode: editing.pageMode,
          isDefault: editing.isDefault,
          active: editing.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar");
      setMsg("Configuração salva.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function action(id: string, patch: Record<string, unknown>) {
    await fetch("/api/doctor/letterheads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir este papel timbrado?")) return;
    await fetch("/api/doctor/letterheads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (editing?.id === id) {
      setEditing(null);
      setFullFile(null);
    }
    await load();
  }

  function onPreviewPointer(e: React.PointerEvent) {
    if (!dragField || !previewRef.current || !editing) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setEditing({
      ...editing,
      fields: {
        ...editing.fields,
        [dragField]: { x: Math.max(0, Math.min(95, x)), y: Math.max(0, Math.min(95, y)), w: 40 },
      },
    });
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-5xl px-5 pb-28 pt-8 lg:pb-10">
          <Link href="/medicos/configuracoes" className="text-sm font-semibold text-[var(--gold)]">
            ← Configurações
          </Link>
          <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">Meus Papéis Timbrados</h1>
          <p className="mt-2 max-w-2xl text-[var(--text-muted)]">
            Envie o PDF ou a imagem do seu receituário. O Meu Rim usa o arquivo como fundo e escreve o conteúdo
            médico na área que você configurar — sem alterar sua identidade visual.
          </p>

          <div className="panel mt-6 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">+ Adicionar papel timbrado</p>
            <input
              className="input-field"
              placeholder="Nome do modelo (ex.: Receituário particular)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-gold" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? "Enviando…" : "Enviar PDF ou imagem"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f);
                }}
              />
            </div>
          </div>

          {msg && <p className="mt-3 text-sm text-[var(--green)]">{msg}</p>}
          {err && <p className="mt-3 text-sm text-[var(--danger)]">{err}</p>}

          <div className="mt-6 grid gap-3">
            {list.length === 0 && (
              <p className="text-[var(--text-muted)]">Nenhum papel timbrado ainda. Envie o PDF ou a imagem do seu receituário.</p>
            )}
            {list.map((lh) => (
              <div key={lh.id} className="panel flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {lh.previewData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={lh.previewData} alt="" className="h-14 w-10 rounded border border-[var(--border)] object-cover" />
                  ) : (
                    <span className="grid h-14 w-10 place-items-center rounded border border-[var(--border)] bg-[var(--bg-soft)] text-[10px] font-bold text-[var(--gold)]">
                      PDF
                    </span>
                  )}
                  <div>
                    <p className="font-semibold text-[var(--text)]">
                      {lh.name}
                      {lh.isDefault && <span className="ml-2 text-xs font-bold text-[var(--gold)]">padrão</span>}
                      {!lh.active && <span className="ml-2 text-xs text-[var(--text-muted)]">inativo</span>}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">{lh.mime} · {lh.fileName || "arquivo"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost" onClick={() => openEdit(lh)}>
                    Configurar área
                  </button>
                  {!lh.isDefault && (
                    <button type="button" className="btn-ghost" onClick={() => action(lh.id, { isDefault: true })}>
                      Definir padrão
                    </button>
                  )}
                  <button type="button" className="btn-ghost" onClick={() => action(lh.id, { action: "duplicate" })}>
                    Duplicar
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => action(lh.id, { active: !lh.active })}>
                    {lh.active ? "Desativar" : "Ativar"}
                  </button>
                  <button type="button" className="text-sm font-semibold text-[var(--danger)]" onClick={() => remove(lh.id)}>
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>

          {editing && (
            <div className="mt-8 space-y-4">
              <h2 className="font-display text-2xl font-extrabold text-[var(--text)]">Configurar área de escrita</h2>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Nome</span>
                <input
                  className="input-field"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["marginTop", "Margem superior (%)"],
                    ["marginBottom", "Margem inferior (%)"],
                    ["marginLeft", "Margem esquerda (%)"],
                    ["marginRight", "Margem direita (%)"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="block">
                    <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
                      {label}: {editing[k]}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={45}
                      value={editing[k]}
                      onChange={(e) => setEditing({ ...editing, [k]: Number(e.target.value) })}
                      className="w-full"
                    />
                  </label>
                ))}
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                  Timbrado nas páginas
                </span>
                <select
                  className="input-field"
                  value={editing.pageMode}
                  onChange={(e) =>
                    setEditing({ ...editing, pageMode: e.target.value as Lh["pageMode"] })
                  }
                >
                  <option value="all">Repetir timbrado em todas as páginas</option>
                  <option value="first">Timbrado somente na primeira página</option>
                  <option value="simplified">Versão simplificada nas páginas seguintes</option>
                </select>
              </label>

              <p className="text-sm text-[var(--text-muted)]">
                Arraste os campos para posicionar. A área destacada é onde o conteúdo médico será escrito.
              </p>
              <div className="flex flex-wrap gap-2">
                {FIELD_KEYS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      dragField === f.id ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"
                    }`}
                    onClick={() => setDragField(dragField === f.id ? null : f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div
                ref={previewRef}
                onPointerMove={onPreviewPointer}
                onPointerUp={() => setDragField(null)}
                className="relative mx-auto aspect-[210/297] w-full max-w-md overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow)]"
                style={{ touchAction: "none" }}
              >
                {fullFile && editing.mime?.startsWith("image/") && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fullFile} alt="Prévia do timbrado" className="absolute inset-0 h-full w-full object-contain" />
                )}
                {fullFile && editing.mime === "application/pdf" && (
                  <iframe title="Prévia PDF" src={fullFile} className="absolute inset-0 h-full w-full" />
                )}
                {/* Área útil */}
                <div
                  className="pointer-events-none absolute border-2 border-dashed border-[var(--gold)] bg-[var(--gold)]/10"
                  style={{
                    top: `${editing.marginTop}%`,
                    bottom: `${editing.marginBottom}%`,
                    left: `${editing.marginLeft}%`,
                    right: `${editing.marginRight}%`,
                  }}
                >
                  <span className="absolute left-1 top-1 rounded bg-[var(--gold)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    ÁREA ÚTIL PARA CONTEÚDO
                  </span>
                </div>
                {FIELD_KEYS.map((f) => {
                  const pos = editing.fields?.[f.id];
                  if (!pos) return null;
                  return (
                    <span
                      key={f.id}
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-[var(--text)] px-1.5 py-0.5 text-[10px] font-bold text-white"
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    >
                      {f.label}
                    </span>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-gold" disabled={busy} onClick={saveConfig}>
                  {busy ? "Salvando…" : "Salvar configuração"}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setEditing(null);
                    setFullFile(null);
                  }}
                >
                  Fechar
                </button>
                <label className="btn-ghost cursor-pointer">
                  Substituir arquivo
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f || !editing) return;
                      const dataUrl = await readAsDataUrl(f);
                      await fetch("/api/doctor/letterheads", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          id: editing.id,
                          fileData: dataUrl,
                          mime: f.type,
                          fileName: f.name,
                        }),
                      });
                      setFullFile(dataUrl);
                      setMsg("Arquivo substituído.");
                      await load();
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
        <DoctorMobileNav />
      </div>
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
