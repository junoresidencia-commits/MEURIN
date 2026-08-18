"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SITE_URL } from "@/lib/site";

type Pub = {
  mode: "api" | "wame";
  phoneDisplay: string; businessAccount: string; wabaId: string; phoneNumberId: string;
  verifyToken: string; templateName: string; inviteMessage: string;
  permMedico: boolean; permAtendente: boolean; permNutricionista: boolean; permOutros: boolean;
  hasAccessToken: boolean; hasAppSecret: boolean; status: string; webhookUrl: string; officialNumber: string;
};
type Msg = { id: string; senderName?: string | null; senderRole?: string | null; recipient?: string | null; recipientPhone?: string | null; method: string; status: string; detail?: string | null; createdAt: string };

const STATUS_STYLE: Record<string, string> = {
  conectado: "bg-emerald-100 text-emerald-700",
  "pronto (wa.me)": "bg-sky-100 text-sky-700",
  desconectado: "bg-slate-100 text-slate-500",
};

export default function WhatsAppIntegracaoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState<Pub | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [testTo, setTestTo] = useState("");
  const [log, setLog] = useState<Msg[]>([]);

  const preview = useMemo(() => (s?.inviteMessage || "").replace(/\{nome\}/g, "Maria").replace(/\{site\}/g, SITE_URL), [s]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/whatsapp");
    if (res.status === 401) { router.replace("/admin/login"); return; }
    setS(await res.json());
    const l = await fetch("/api/admin/whatsapp/log").then((r) => r.json()).catch(() => ({ messages: [] }));
    setLog(l.messages || []);
    setLoading(false);
  }, [router]);
  useEffect(() => { load(); }, [load]);

  function set<K extends keyof Pub>(k: K, v: Pub[K]) { setS((p) => (p ? { ...p, [k]: v } : p)); }

  async function save() {
    if (!s) return;
    setSaving(true); setMsg("");
    try {
      const body: Record<string, unknown> = { ...s };
      delete body.hasAccessToken; delete body.hasAppSecret; delete body.status; delete body.webhookUrl; delete body.officialNumber;
      if (accessToken) body.accessToken = accessToken;
      if (appSecret) body.appSecret = appSecret;
      const res = await fetch("/api/admin/whatsapp", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erro");
      setS(d); setAccessToken(""); setAppSecret("");
      setMsg("Configurações salvas com segurança.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); setTimeout(() => setMsg(""), 3000); }
  }

  async function testConnection() {
    setTestResult("Testando…");
    const r = await fetch("/api/admin/whatsapp/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "connection" }) }).then((x) => x.json());
    setTestResult((r.ok ? "✅ " : "⚠️ ") + (r.detail || ""));
  }
  async function testMessage() {
    if (!testTo) { setTestResult("Informe um número para o teste."); return; }
    setTestResult("Enviando…");
    const r = await fetch("/api/admin/whatsapp/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "message", to: testTo, message: preview }) }).then((x) => x.json());
    if (r.method === "wame" && r.url) { window.open(r.url, "_blank", "noopener,noreferrer"); setTestResult("Abrindo o WhatsApp (envio assistido via wa.me)…"); }
    else setTestResult((r.ok ? "✅ Enviado pela API oficial." : "⚠️ " + (r.detail || "Falhou")));
    await load();
  }

  if (loading || !s) return <div className="mx-auto max-w-3xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/admin" className="text-sm font-semibold text-[var(--gold)]">← Administração</Link>
      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Configurações › Integrações</p>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">WhatsApp</h1>
      <p className="mt-1 text-[var(--text-muted)]">Envio de convites e mensagens de acesso. Quando a API oficial estiver configurada, o envio é automático pelo número oficial; enquanto isso, usa o wa.me (envio assistido).</p>

      {/* 1. Status */}
      <section className="panel mt-6">
        <h2 className="font-display text-xl text-[var(--text)]">Status da integração</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)]">Número oficial</p>
            <p className="font-semibold text-[var(--text)]">{s.phoneDisplay}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[s.status] || "bg-slate-100 text-slate-500"}`}>{s.status}</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${s.mode === "api" ? "border-[var(--border-gold)] bg-[var(--gold-soft)]" : "border-[var(--border)]"}`}>
            <input type="radio" name="mode" className="mt-1 accent-[var(--gold)]" checked={s.mode === "api"} onChange={() => set("mode", "api")} />
            <span><b className="text-[var(--text)]">API oficial</b> — envio automático<br /><span className="text-xs text-[var(--text-muted)]">Requer configuração da Meta abaixo.</span></span>
          </label>
          <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${s.mode === "wame" ? "border-[var(--border-gold)] bg-[var(--gold-soft)]" : "border-[var(--border)]"}`}>
            <input type="radio" name="mode" className="mt-1 accent-[var(--gold)]" checked={s.mode === "wame"} onChange={() => set("mode", "wame")} />
            <span><b className="text-[var(--text)]">wa.me</b> — envio assistido<br /><span className="text-xs text-[var(--text-muted)]">Abre o WhatsApp com a mensagem pronta.</span></span>
          </label>
        </div>
      </section>

      {/* 2. Configuração da Meta */}
      <section className="panel mt-4">
        <h2 className="font-display text-xl text-[var(--text)]">Configuração da Meta</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Credenciais da API do WhatsApp Business (Meta). Tokens e segredos são <b>criptografados no servidor</b> e nunca aparecem aqui depois de salvos.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Conta comercial (Business)</span><input className="input-field" value={s.businessAccount} onChange={(e) => set("businessAccount", e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">WhatsApp Business Account ID</span><input className="input-field" value={s.wabaId} onChange={(e) => set("wabaId", e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Phone Number ID</span><input className="input-field" value={s.phoneNumberId} onChange={(e) => set("phoneNumberId", e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Modelo de mensagem aprovado</span><input className="input-field" value={s.templateName} onChange={(e) => set("templateName", e.target.value)} placeholder="ex.: convite_acesso" /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Token de acesso {s.hasAccessToken && <span className="text-[var(--green,#0d9488)]">• salvo</span>}</span><input type="password" className="input-field" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder={s.hasAccessToken ? "•••••••• (deixe em branco p/ manter)" : "cole o token"} autoComplete="off" /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">App Secret {s.hasAppSecret && <span className="text-[var(--green,#0d9488)]">• salvo</span>}</span><input type="password" className="input-field" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder={s.hasAppSecret ? "•••••••• (deixe em branco p/ manter)" : "cole o app secret"} autoComplete="off" /></label>
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Webhook (configure na Meta)</span><input className="input-field" value={s.webhookUrl} readOnly /></label>
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Token de verificação do webhook</span><input className="input-field" value={s.verifyToken} onChange={(e) => set("verifyToken", e.target.value)} /></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a className="btn-ghost" href="https://business.facebook.com/wa/manage/" target="_blank" rel="noopener noreferrer">Conectar com a Meta</a>
          <button type="button" className="btn-ghost" onClick={testConnection}>Testar conexão</button>
          {testResult && <span className="text-sm text-[var(--text-soft)]">{testResult}</span>}
        </div>
      </section>

      {/* 3. Permissão para enviar */}
      <section className="panel mt-4">
        <h2 className="font-display text-xl text-[var(--text)]">Permissão para enviar</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Quem pode enviar/reenviar convites e mensagens pelo WhatsApp.</p>
        <div className="mt-3 flex flex-wrap gap-4">
          {([["permMedico", "Médico"], ["permAtendente", "Atendente"], ["permNutricionista", "Nutricionista"], ["permOutros", "Outros autorizados"]] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
              <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={s[k]} onChange={(e) => set(k, e.target.checked)} /> {label}
            </label>
          ))}
        </div>
      </section>

      {/* 4. Mensagem de convite */}
      <section className="panel mt-4">
        <h2 className="font-display text-xl text-[var(--text)]">Mensagem de convite</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Use <code className="rounded bg-[var(--bg)] px-1">{"{nome}"}</code> e <code className="rounded bg-[var(--bg)] px-1">{"{site}"}</code>. Não inclua CPF, senha, exames ou diagnóstico.</p>
        <textarea className="input-field mt-2 min-h-[120px]" value={s.inviteMessage} onChange={(e) => set("inviteMessage", e.target.value)} />
        <p className="mt-2 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Prévia</p>
        <pre className="mt-1 whitespace-pre-wrap rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 font-sans text-sm text-[var(--text-soft)]">{preview}</pre>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Número para teste</span><input className="input-field w-56" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Ex.: 73999995555" inputMode="tel" /></label>
          <button type="button" className="btn-ghost" onClick={testMessage}>Enviar mensagem de teste</button>
        </div>
      </section>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" className="btn-gold" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar configurações"}</button>
        {msg && <span className="text-sm font-semibold text-[var(--green,#0d9488)]">{msg}</span>}
      </div>

      {/* 5. Histórico */}
      <section className="panel mt-6">
        <h2 className="font-display text-xl text-[var(--text)]">Histórico de envios</h2>
        {log.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum envio registrado ainda.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[var(--text-muted)]">
                <tr><th className="py-1 pr-3">Data</th><th className="py-1 pr-3">Responsável</th><th className="py-1 pr-3">Destinatário</th><th className="py-1 pr-3">Forma</th><th className="py-1">Status</th></tr>
              </thead>
              <tbody>
                {log.map((m) => (
                  <tr key={m.id} className="border-t border-[var(--border)]">
                    <td className="py-1 pr-3 text-[var(--text-muted)]">{new Date(m.createdAt).toLocaleString("pt-BR")}</td>
                    <td className="py-1 pr-3">{m.senderName || m.senderRole || "—"}</td>
                    <td className="py-1 pr-3">{m.recipientPhone || m.recipient || "—"}</td>
                    <td className="py-1 pr-3">{m.method === "api" ? "API" : "wa.me"}</td>
                    <td className="py-1"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m.status === "enviado" || m.status === "entregue" || m.status === "lido" ? "bg-emerald-100 text-emerald-700" : m.status === "falhou" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>{m.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-6 text-xs text-[var(--text-muted)]">
        Segurança: credenciais criptografadas no servidor; tokens/segredos nunca aparecem no frontend, nos logs ou no código. O convite não expõe CPF, senha ou dados clínicos.
      </p>
    </div>
  );
}
