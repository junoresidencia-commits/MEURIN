"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

export default function ConvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<{ kind: string; name: string; email: string; clinicName: string } | null>(null);
  const [err, setErr] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState("");

  useEffect(() => {
    fetch(`/api/convite/${params.token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErr(d.error);
        else setInfo(d.invite);
      })
      .catch(() => setErr("Não foi possível abrir o convite."));
  }, [params.token]);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const res = await fetch(`/api/convite/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível aceitar.");
      setDone(data.loginPath);
      setTimeout(() => router.push(data.loginPath), 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  if (err && !info) {
    return (
      <AuthShell eyebrow="Convite" title="Convite inválido">
        <p className="text-sm text-[var(--text-soft)]">{err}</p>
        <Link href="/" className="btn-gold mt-4 block text-center">Ir ao início</Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell eyebrow="Pronto" title="Senha criada">
        <p className="text-sm text-[var(--text-soft)]">Entre com o e-mail do convite e a senha que você acabou de definir.</p>
        <Link href={done} className="btn-gold mt-4 block text-center">Ir para o login</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Convite da clínica" title={info ? `Entrar em ${info.clinicName}` : "Carregando…"}>
      {info && (
        <form onSubmit={accept} className="panel space-y-3">
          <p className="text-sm text-[var(--text-soft)]">
            {info.name} · {info.email}. A clínica não definiu a sua senha — crie uma agora.
          </p>
          <input className="input-field" type="password" minLength={6} placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" className="btn-gold w-full" disabled={saving}>{saving ? "Salvando…" : "Criar senha e aceitar"}</button>
          {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
        </form>
      )}
    </AuthShell>
  );
}
