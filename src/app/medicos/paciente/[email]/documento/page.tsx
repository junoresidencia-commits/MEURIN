"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { TemplatePicker } from "@/components/TemplatePicker";
import { PosologyBuilder } from "@/components/PosologyBuilder";
import type { TemplateType } from "@/lib/document-templates";
import { useOfflineOptional } from "@/components/offline/OfflineProvider";
import { OfflineNeedsNet } from "@/components/offline/OfflineBanner";
import { draftKey, enqueue, getDraft, loadSession, newClientOpId, saveDraft } from "@/lib/offline/idb";
import type { OfflineDraft } from "@/lib/offline/types";

const TEMPLATE_TYPES = ["receita", "exame", "relatorio"];

type Letterhead = { id: string; name: string; kind: string; isDefault: boolean; active: boolean };

const TYPES = [
  { id: "livre", label: "Documento livre" },
  { id: "receita", label: "Receita" },
  { id: "exame", label: "Pedido de exames" },
  { id: "relatorio", label: "Relatório" },
  { id: "atestado", label: "Atestado" },
  { id: "declaracao", label: "Declaração" },
  { id: "encaminhamento", label: "Encaminhamento" },
  { id: "parecer", label: "Parecer" },
  { id: "orientacao", label: "Orientações" },
  { id: "laudo", label: "Laudo" },
];

function ComporDocumentoInner() {
  const params = useParams<{ email: string }>();
  const patientParam = decodeURIComponent(params.email);
  const sp = useSearchParams();
  const prefType = sp.get("type");
  const initialType = prefType && TYPES.some((t) => t.id === prefType) ? prefType : "livre";

  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [letterheadId, setLetterheadId] = useState<string>("");
  const [type, setType] = useState(initialType);
  const [title, setTitle] = useState(sp.get("title") || "");
  const [content, setContent] = useState(sp.get("body") || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [draftAt, setDraftAt] = useState<string | null>(null);
  const offline = useOfflineOptional();

  function draftKind(): OfflineDraft["kind"] {
    if (type === "receita") return "receita";
    if (type === "relatorio") return "relatorio";
    return "documento";
  }

  const load = useCallback(async () => {
    const r = await fetch("/api/doctor/letterheads").then((x) => x.json());
    const list: Letterhead[] = (r.letterheads || []).filter((l: Letterhead) => l.active);
    setLetterheads(list);
    const def = list.find((l) => l.isDefault) || list[0];
    if (def) setLetterheadId(def.id);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sess = await loadSession();
      if (!sess || cancelled) return;
      const d = await getDraft(sess.doctorId, patientParam, draftKind());
      // Prefill da URL (repetir receita/exames, meds da evolução) prevalece sobre rascunho antigo.
      if (sp.get("body")) return;
      if (d?.payload && !cancelled) {
        if (typeof d.payload.title === "string" && d.payload.title) setTitle(d.payload.title);
        if (typeof d.payload.content === "string" && d.payload.content) setContent(d.payload.content);
        if (typeof d.payload.type === "string" && d.payload.type) setType(d.payload.type);
        setDraftAt(d.updatedAt);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientParam]);

  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        if (!title.trim() && !content.trim()) return;
        const sess = offline?.session || (await loadSession());
        if (!sess) return;
        const at = new Date().toISOString();
        await saveDraft({
          key: draftKey(sess.doctorId, patientParam, draftKind()),
          doctorId: sess.doctorId,
          patientKey: patientParam,
          kind: draftKind(),
          payload: { type, title, content, letterheadId },
          updatedAt: at,
        });
        setDraftAt(at);
      })();
    }, 800);
    return () => clearTimeout(t);
  }, [type, title, content, letterheadId, patientParam, offline?.session]);

  function payload(preview: boolean) {
    return {
      patientKey: patientParam,
      letterheadId: letterheadId || null,
      type,
      title,
      content,
      preview,
    };
  }

  async function preview() {
    if (!navigator.onLine) {
      setMsg("Esta função precisa de conexão com a internet.");
      return;
    }
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(true)),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Falha ao pré-visualizar."); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro.");
    } finally { setBusy(false); }
  }

  async function salvar() {
    setBusy(true); setMsg("");
    const sess = offline?.session || (await loadSession());
    try {
      if (!navigator.onLine) {
        if (!sess) throw new Error("Abra o prontuário online uma vez para salvar o documento offline.");
        await enqueue({
          id: newClientOpId(),
          doctorId: sess.doctorId,
          patientKey: patientParam,
          kind: "document.generate",
          label: type === "receita" ? "Receita" : type === "relatorio" ? "Relatório" : "Documento",
          payload: payload(false),
          status: "pending",
          createdAt: new Date().toISOString(),
          attempts: 0,
        });
        await offline?.refreshQueue();
        setMsg("Rascunho salvo neste dispositivo. O PDF será gerado quando a internet retornar.");
        return;
      }
      const res = await fetch("/api/documents/generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(false)),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Falha ao gerar.");
      setSavedId(d.id); setStatus("final");
      setPreviewUrl(`/api/documents/${d.id}/pdf`);
      setMsg("Documento gerado e salvo no prontuário.");
    } catch (e) {
      if (!navigator.onLine && sess) {
        await enqueue({
          id: newClientOpId(),
          doctorId: sess.doctorId,
          patientKey: patientParam,
          kind: "document.generate",
          label: type === "receita" ? "Receita" : type === "relatorio" ? "Relatório" : "Documento",
          payload: payload(false),
          status: "pending",
          createdAt: new Date().toISOString(),
          attempts: 0,
        });
        await offline?.refreshQueue();
        setMsg("Rascunho salvo neste dispositivo. O PDF será gerado quando a internet retornar.");
        return;
      }
      setMsg(e instanceof Error ? e.message : "Erro.");
    } finally { setBusy(false); }
  }

  async function assinar() {
    if (!savedId) return;
    setBusy(true); setMsg("");
    const res = await fetch(`/api/documents/${savedId}/sign`, { method: "POST" });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg(d.error || "Falha ao assinar."); return; }
    setStatus("signed"); setMsg("Documento assinado (assinatura eletrônica). Versão imutável.");
  }
  async function disponibilizar(available: boolean) {
    if (!savedId) return;
    setBusy(true); setMsg("");
    const res = await fetch(`/api/documents/${savedId}/availability`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ available }),
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg(d.error || "Falha."); return; }
    setMsg(available ? "Disponibilizado na área do paciente." : "Removido da área do paciente.");
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <Link href={`/medicos/paciente/${params.email}`} className="text-sm font-semibold text-[var(--gold)]">← Prontuário</Link>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Novo documento</h1>
      <p className="mt-1 text-[var(--text-muted)]">Escolha o papel timbrado, escreva o conteúdo, pré-visualize e gere o PDF.</p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* Editor */}
        <div className="panel">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Tipo</span>
              <select className="input-field" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Papel timbrado</span>
              <select className="input-field" value={letterheadId} onChange={(e) => setLetterheadId(e.target.value)}>
                <option value="">Sem papel timbrado</option>
                {letterheads.map((l) => <option key={l.id} value={l.id}>{l.name}{l.isDefault ? " (padrão)" : ""}</option>)}
              </select>
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Título</span>
            <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Relatório médico" />
          </label>
          {TEMPLATE_TYPES.includes(type) && (
            <div className="mt-3">
              <TemplatePicker
                type={type as TemplateType}
                currentText={content}
                onApply={(t) => setContent(t)}
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Use um modelo pronto (ex.: exames de DRC, glomerulopatia) ou salve o conteúdo atual como <b>modelo favorito</b> para reutilizar.
              </p>
            </div>
          )}
          {type === "receita" && (
            <div className="mt-3">
              <PosologyBuilder onAdd={(t) => setContent((c) => (c.trim() ? `${c.trim()}\n\n${t}` : t))} />
            </div>
          )}
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Conteúdo</span>
            <textarea className="input-field min-h-[280px]" value={content} onChange={(e) => setContent(e.target.value)}
              placeholder={"Escreva o conteúdo. Use **negrito**, listas com \"- \" e campos automáticos como {{paciente_nome}}, {{data_atual}}, {{medico_nome}}."} />
          </label>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Campos: <code>{"{{paciente_nome}}"}</code> <code>{"{{paciente_cpf}}"}</code> <code>{"{{paciente_idade}}"}</code> <code>{"{{data_atual}}"}</code> <code>{"{{medico_nome}}"}</code> <code>{"{{medico_crm}}"}</code> <code>{"{{medico_rqe}}"}</code>
          </p>
          {draftAt && (
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
              Rascunho salvo localmente às {new Date(draftAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <OfflineNeedsNet label="Pré-visualizar o PDF precisa de conexão com a internet.">
              <button type="button" className="btn-ghost" onClick={preview} disabled={busy}>Pré-visualizar</button>
            </OfflineNeedsNet>
            <button type="button" className="btn-gold" onClick={salvar} disabled={busy || !content.trim()}>
              {offline && !offline.online ? "Salvar neste dispositivo" : "Gerar PDF e salvar"}
            </button>
          </div>

          {savedId && (
            <div className="mt-4 rounded-xl border border-[var(--border)] p-3">
              <p className="text-sm font-semibold text-[var(--text)]">Documento salvo no prontuário {status === "signed" && "· assinado"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a className="btn-ghost text-sm" href={`/api/documents/${savedId}/pdf`} target="_blank" rel="noopener noreferrer">Abrir PDF</a>
                {status !== "signed" && <button type="button" className="btn-ghost text-sm" onClick={assinar} disabled={busy}>Assinar</button>}
                <button type="button" className="btn-gold text-sm" onClick={() => disponibilizar(true)} disabled={busy}>Disponibilizar ao paciente</button>
                <button type="button" className="btn-ghost text-sm" onClick={() => disponibilizar(false)} disabled={busy}>Remover do paciente</button>
              </div>
            </div>
          )}
          {msg && <p className="mt-3 text-sm font-semibold text-[var(--gold)]">{msg}</p>}
        </div>

        {/* Pré-visualização */}
        <div className="panel">
          <p className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Pré-visualização</p>
          {previewUrl ? (
            <iframe src={previewUrl} title="Pré-visualização" className="h-[70vh] w-full rounded-lg border border-[var(--border)]" />
          ) : (
            <div className="grid h-[70vh] place-items-center rounded-lg border border-dashed border-[var(--border)] text-center text-sm text-[var(--text-muted)]">
              Clique em “Pré-visualizar” para ver o PDF com o seu papel timbrado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ComporDocumentoPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>}>
      <ComporDocumentoInner />
    </Suspense>
  );
}
