"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Box = { id: string; label: string; page: number; xFrac: number; yFrac: number; size: number; text: string };
type PageImg = { url: string; w: number; h: number };

const DEFAULT_BOXES = (vals: Record<string, string>): Box[] => [
  { id: "name", label: "Nome do paciente", page: 0, xFrac: 0.22, yFrac: 0.74, size: 11, text: vals.name || "" },
  { id: "cns", label: "CNS do paciente", page: 0, xFrac: 0.22, yFrac: 0.79, size: 11, text: vals.cns || "" },
  { id: "date", label: "Data", page: 0, xFrac: 0.76, yFrac: 0.74, size: 11, text: vals.date || "" },
  { id: "doctor", label: "Médico", page: 0, xFrac: 0.22, yFrac: 0.86, size: 11, text: vals.doctor || "" },
  { id: "crm", label: "CRM", page: 0, xFrac: 0.62, yFrac: 0.86, size: 11, text: vals.crm || "" },
];

function Editor() {
  const sp = useSearchParams();
  const protocol = sp.get("protocol") || "";
  const doc = sp.get("doc") || "ter";
  const docKey = `${protocol}:${doc}`;
  const vals = {
    name: sp.get("name") || "", cns: sp.get("cns") || "", date: sp.get("date") || "",
    doctor: sp.get("doctor") || "", crm: sp.get("crm") || "",
  };

  const [pages, setPages] = useState<PageImg[]>([]);
  const [boxes, setBoxes] = useState<Box[]>(DEFAULT_BOXES(vals));
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const dragging = useRef<{ id: string; page: number } | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Renderiza a(s) página(s) oficiais como imagem via pdf.js.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        const buf = await fetch(`/api/ceaf/official?protocol=${protocol}&doc=${doc}`).then((r) => r.arrayBuffer());
        const pdf = await pdfjs.getDocument({ data: buf }).promise;
        const imgs: PageImg[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width; canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          imgs.push({ url: canvas.toDataURL("image/png"), w: viewport.width, h: viewport.height });
        }
        if (cancelled) return;
        setPages(imgs);
        // Carrega padrão salvo (posições) se houver.
        const saved = await fetch(`/api/ceaf/pattern?docKey=${encodeURIComponent(docKey)}`).then((r) => r.json()).catch(() => ({}));
        if (saved?.boxes && Array.isArray(saved.boxes) && saved.boxes.length) {
          setBoxes(saved.boxes.map((b: Box, i: number) => ({
            id: b.id || `b${i}`, label: b.label || `Campo ${i + 1}`, page: b.page || 0,
            xFrac: b.xFrac, yFrac: b.yFrac, size: b.size || 11,
            text: (vals as Record<string, string>)[b.id] ?? b.text ?? "",
          })));
        }
      } catch (e) {
        setMsg("Não foi possível carregar o documento. " + (e instanceof Error ? e.message : ""));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocol, doc]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragging.current;
    if (!d) return;
    const el = pageRefs.current[d.page];
    if (!el) return;
    const r = el.getBoundingClientRect();
    const xFrac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const yFrac = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    setBoxes((bs) => bs.map((b) => (b.id === d.id ? { ...b, xFrac, yFrac } : b)));
  }, []);
  const onPointerUp = useCallback(() => { dragging.current = null; }, []);
  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => { window.removeEventListener("pointermove", onPointerMove); window.removeEventListener("pointerup", onPointerUp); };
  }, [onPointerMove, onPointerUp]);

  function setText(id: string, text: string) { setBoxes((bs) => bs.map((b) => (b.id === id ? { ...b, text } : b))); }
  function setSize(id: string, size: number) { setBoxes((bs) => bs.map((b) => (b.id === id ? { ...b, size } : b))); }
  function addBox() {
    setBoxes((bs) => [...bs, { id: `b${Date.now()}`, label: "Novo campo", page: 0, xFrac: 0.3, yFrac: 0.4, size: 11, text: "" }]);
  }
  function removeBox(id: string) { setBoxes((bs) => bs.filter((b) => b.id !== id)); }

  async function gerar() {
    setMsg("");
    const payload = { protocol, doc, boxes: boxes.map((b) => ({ page: b.page, xFrac: b.xFrac, yFrac: b.yFrac, text: b.text, size: b.size })) };
    const res = await fetch("/api/ceaf/official", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { setMsg("Falha ao gerar."); return; }
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), "_blank");
  }
  async function salvarPadrao() {
    setMsg("");
    const layout = boxes.map((b) => ({ id: b.id, label: b.label, page: b.page, xFrac: b.xFrac, yFrac: b.yFrac, size: b.size }));
    const res = await fetch("/api/ceaf/pattern", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docKey, boxes: layout }) });
    setMsg(res.ok ? "Padrão salvo — as posições serão reaproveitadas neste documento." : "Não foi possível salvar o padrão.");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">Preencher documento oficial</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Digite nos campos e **arraste** cada caixa até a linha certa do documento. Salve como padrão para reaproveitar a posição.</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Painel de campos */}
        <div className="panel h-fit">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Campos</p>
          <div className="mt-2 grid gap-2">
            {boxes.map((b) => (
              <div key={b.id} className="rounded-xl border border-[var(--border)] p-2">
                <div className="flex items-center justify-between gap-2">
                  <input className="input-field !py-1 text-xs" value={b.label} onChange={(e) => setBoxes((bs) => bs.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x)))} />
                  <button type="button" className="text-xs text-[var(--danger)]" onClick={() => removeBox(b.id)}>×</button>
                </div>
                <input className="input-field mt-1" placeholder="valor a escrever" value={b.text} onChange={(e) => setText(b.id, e.target.value)} />
                <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span>Tamanho</span>
                  <input type="range" min={7} max={16} value={b.size} onChange={(e) => setSize(b.id, Number(e.target.value))} className="flex-1 accent-[var(--gold)]" />
                  <span>{b.size}pt</span>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn-ghost mt-2 w-full text-sm" onClick={addBox}>+ Adicionar caixa</button>
          <div className="mt-3 flex flex-col gap-2">
            <button type="button" className="btn-gold" onClick={gerar}>Gerar PDF</button>
            <button type="button" className="btn-ghost" onClick={salvarPadrao}>Salvar padrão (posições)</button>
          </div>
          {msg && <p className="mt-2 text-sm font-semibold text-[var(--gold)]">{msg}</p>}
        </div>

        {/* Documento com caixas arrastáveis */}
        <div className="grid gap-4">
          {loading && <p className="text-[var(--text-muted)]">Carregando documento oficial…</p>}
          {pages.map((pg, pi) => (
            <div
              key={pi}
              ref={(el) => { pageRefs.current[pi] = el; }}
              className="relative mx-auto w-full max-w-[760px] overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow"
              style={{ aspectRatio: `${pg.w} / ${pg.h}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pg.url} alt={`Página ${pi + 1}`} className="pointer-events-none block w-full select-none" />
              {boxes.filter((b) => b.page === pi).map((b) => (
                <div
                  key={b.id}
                  onPointerDown={(e) => { e.preventDefault(); dragging.current = { id: b.id, page: pi }; }}
                  className="absolute cursor-move rounded border border-dashed border-[var(--gold)] bg-white/70 px-1 py-0.5 text-[var(--text)]"
                  style={{ left: `${b.xFrac * 100}%`, top: `${b.yFrac * 100}%`, fontSize: `${b.size}px`, transform: "translate(0,-2px)", touchAction: "none", whiteSpace: "nowrap" }}
                  title="Arraste para posicionar"
                >
                  {b.text || <span className="text-[var(--text-muted)]">{b.label}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DocumentoOficialPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>}>
      <Editor />
    </Suspense>
  );
}
