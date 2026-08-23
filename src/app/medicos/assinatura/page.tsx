"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";

type Visual = { kind: "typed" | "image" | "draw"; value: string } | null;
type Icp = { configured: boolean; providerId: string | null };

export default function MinhaAssinaturaPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [icp, setIcp] = useState<Icp>({ configured: false, providerId: null });
  const [docInfo, setDocInfo] = useState<{ name: string; crm: string; rqe: string | null }>({ name: "", crm: "", rqe: null });
  const [visual, setVisual] = useState<Visual>(null);
  const [mode, setMode] = useState<"typed" | "image" | "draw">("typed");
  const [typed, setTyped] = useState("");
  const [msg, setMsg] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => {
      if (!d.doctor) { router.replace("/medicos/login"); return; }
      setReady(true);
      fetch("/api/doctor/signature").then((r) => r.json()).then((x) => {
        setIcp(x.icp || { configured: false, providerId: null });
        setDocInfo(x.doctor || { name: "", crm: "", rqe: null });
        setVisual(x.visual || null);
        if (x.visual?.kind === "typed") { setTyped(x.visual.value); setMode("typed"); }
      }).catch(() => {});
    });
  }, [router]);

  function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setVisual({ kind: "image", value: String(reader.result) });
    reader.readAsDataURL(f);
  }

  // Canvas de desenho
  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function up() { drawing.current = false; }
  function clearCanvas() {
    const c = canvasRef.current;
    if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
  }

  async function saveVisual() {
    setMsg("");
    let payload: Visual = null;
    if (mode === "typed") payload = typed.trim() ? { kind: "typed", value: typed.trim() } : null;
    else if (mode === "image") payload = visual?.kind === "image" ? visual : null;
    else if (mode === "draw") {
      const c = canvasRef.current!;
      payload = { kind: "draw", value: c.toDataURL("image/png") };
    }
    if (!payload) { setMsg("Defina a assinatura antes de salvar."); return; }
    const res = await fetch("/api/doctor/signature", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visual: payload }) });
    if (res.ok) { const d = await res.json(); setVisual(d.visual); setMsg("Assinatura visual salva."); }
    else setMsg("Não foi possível salvar.");
  }
  async function removeVisual() {
    setMsg("");
    const res = await fetch("/api/doctor/signature", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visual: null }) });
    if (res.ok) { setVisual(null); setTyped(""); clearCanvas(); setMsg("Assinatura visual removida."); }
  }

  if (!ready) return <div className="mx-auto max-w-3xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl px-5 pb-28 pt-8 lg:pb-8">
          <Link href="/medicos/mais" className="text-sm font-semibold text-[var(--gold)]">← Mais</Link>
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Minha assinatura digital</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{docInfo.name} · {docInfo.crm}{docInfo.rqe ? ` · RQE ${docInfo.rqe}` : ""}</p>

          {/* ICP-Brasil */}
          <section className="panel mt-6">
            <h2 className="font-display text-xl text-[var(--text)]">Assinatura digital ICP-Brasil</h2>
            {icp.configured ? (
              <div className="mt-2">
                <p className="text-sm text-[var(--text-soft)]">Provedor: <b>{icp.providerId}</b></p>
                <button type="button" className="btn-gold mt-3">Conectar certificado</button>
              </div>
            ) : (
              <div className="mt-2">
                <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Integração ICP-Brasil <b>aguardando configuração do provedor</b>. Quando o provedor de certificado em nuvem
                  (ex.: BirdID, VIDaaS, SafeID) estiver contratado e configurado, a assinatura digital qualificada (PAdES)
                  ficará disponível aqui — assinada dentro do Meu Rim, sem baixar nem reenviar arquivos.
                </p>
                <button type="button" className="btn-ghost mt-3 opacity-60" disabled title="Aguardando configuração do provedor">Conectar certificado</button>
                <p className="mt-2 text-xs text-[var(--text-muted)]">Enquanto isso, você pode usar <b>Baixar para assinatura manual</b> na tela do documento.</p>
              </div>
            )}
          </section>

          {/* Assinatura visual */}
          <section className="panel mt-6">
            <h2 className="font-display text-xl text-[var(--text)]">Assinatura visual (aparência)</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              É apenas a <b>imagem</b> da sua assinatura no documento. <b>Não</b> tem validade jurídica de assinatura digital
              ICP-Brasil — quando a validade externa for exigida, use a assinatura digital ICP-Brasil ou a assinatura manual.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {(["typed", "draw", "image"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${mode === m ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"}`}>
                  {m === "typed" ? "Digitar" : m === "draw" ? "Desenhar" : "Enviar imagem"}
                </button>
              ))}
            </div>

            <div className="mt-3">
              {mode === "typed" && (
                <div>
                  <input className="input-field" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Seu nome como assinatura" />
                  {typed.trim() && <p className="mt-2 border-b border-[var(--text)] pb-1 text-2xl italic text-[var(--text)]" style={{ fontFamily: "cursive" }}>{typed}</p>}
                </div>
              )}
              {mode === "draw" && (
                <div>
                  <canvas
                    ref={canvasRef}
                    width={480}
                    height={160}
                    className="w-full max-w-lg touch-none rounded-xl border border-[var(--border)] bg-white"
                    onPointerDown={down}
                    onPointerMove={move}
                    onPointerUp={up}
                    onPointerLeave={up}
                  />
                  <button type="button" className="btn-ghost mt-2 text-sm" onClick={clearCanvas}>Limpar</button>
                </div>
              )}
              {mode === "image" && (
                <div>
                  <input type="file" accept="image/png,image/jpeg" onChange={onImage} />
                  {visual?.kind === "image" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={visual.value} alt="Assinatura" className="mt-2 max-h-32 rounded-xl border border-[var(--border)] bg-white p-2" />
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-gold" onClick={saveVisual}>Salvar assinatura visual</button>
              {visual && <button type="button" className="btn-ghost" onClick={removeVisual}>Remover</button>}
            </div>
            {msg && <p className="mt-2 text-sm font-semibold text-[var(--gold)]">{msg}</p>}

            {visual && (
              <div className="mt-4 rounded-xl border border-[var(--border)] p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Assinatura atual</p>
                {visual.kind === "typed" ? (
                  <p className="mt-1 text-2xl italic text-[var(--text)]" style={{ fontFamily: "cursive" }}>{visual.value}</p>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={visual.value} alt="Assinatura atual" className="mt-1 max-h-28" />
                )}
              </div>
            )}
          </section>

          <section className="panel mt-6">
            <h2 className="font-display text-xl text-[var(--text)]">Como os documentos são finalizados</h2>
            <ul className="mt-2 space-y-1 text-sm text-[var(--text-soft)]">
              <li>• <b>Aprovação eletrônica interna</b>: registra autoria/integridade no Meu Rim (não substitui a assinatura legal).</li>
              <li>• <b>Assinatura digital ICP-Brasil</b>: assinatura qualificada (PAdES) — disponível quando o provedor estiver configurado.</li>
              <li>• <b>Assinatura manual</b>: baixar, imprimir, assinar e carimbar; depois anexar a cópia ao prontuário.</li>
            </ul>
          </section>
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}
