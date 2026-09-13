"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Member = {
  id: string;
  actorKind: string;
  actorId: string;
  role: string;
  status: string;
  name: string;
  email: string | null;
  feeCents: number | null;
  clinicSharePercent: number | null;
};
type Invite = { id: string; kind: string; name: string; email: string; status: string; token: string; createdAt: string; feeCents?: number | null; clinicSharePercent?: number | null };

export default function ClinicaEquipePage() {
  const params = useParams<{ id: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [kind, setKind] = useState<"doctor" | "attendant">("doctor");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [crm, setCrm] = useState("");
  const [specialty, setSpecialty] = useState("Nefrologia");
  const [fee, setFee] = useState("450");
  const [share, setShare] = useState("30");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch(`/api/clinica/${params.id}/invite`)
      .then((r) => r.json())
      .then((d) => {
        setMembers(d.members || []);
        setInvites(d.invites || []);
      })
      .catch(() => {});
  }
  useEffect(() => { load(); }, [params.id]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const feeCents = kind === "doctor" ? Math.round(Number(fee) * 100) : undefined;
      const clinicSharePercent = kind === "doctor" ? Number(share) : undefined;
      const res = await fetch(`/api/clinica/${params.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name, email, crm, specialty, feeCents, clinicSharePercent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível convidar.");
      if (data.linkedExisting) {
        setMsg(
          kind === "doctor"
            ? `Médico já existia — vinculado a esta clínica com ${brl(feeCents || 0)} e ${clinicSharePercent}% para a clínica. A senha dele não muda.`
            : "Pessoa já existia — vinculada à clínica, sem nova conta e sem alterar senha."
        );
      } else {
        setMsg(`Convite criado. Envie este link para a pessoa definir a própria senha: ${data.acceptUrl}`);
      }
      setName("");
      setEmail("");
      setCrm("");
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Equipe da clínica</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        A gestora define o valor e o % <strong>desta clínica</strong> ao cadastrar o médico.
        O mesmo médico pode ter R$ 450 e 30% aqui e R$ 550 e 20% em outra cidade. A senha dele não muda.
      </p>
      <form onSubmit={invite} className="panel mt-5 grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Tipo</span>
          <select className="input-field" value={kind} onChange={(e) => setKind(e.target.value as "doctor" | "attendant")}>
            <option value="doctor">Médico</option>
            <option value="attendant">Atendente</option>
          </select>
        </label>
        <input className="input-field" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="input-field" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {kind === "doctor" && (
          <>
            <input className="input-field" placeholder="CRM" value={crm} onChange={(e) => setCrm(e.target.value)} />
            <input className="input-field" placeholder="Especialidade" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
            <label>
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Valor nesta clínica (R$)</span>
              <input className="input-field" type="number" min="0" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} required />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">% da clínica neste vínculo</span>
              <input className="input-field" type="number" min="0" max="100" step="0.1" value={share} onChange={(e) => setShare(e.target.value)} required />
            </label>
            <p className="sm:col-span-2 text-xs text-[var(--text-muted)]">
              Ex.: R$ 450 e 30% → clínica R$ 135, médico R$ 315. Em outra clínica o valor pode ser outro.
            </p>
          </>
        )}
        <button type="submit" className="btn-gold sm:col-span-2" disabled={saving}>
          {saving ? "Enviando…" : kind === "doctor" ? "Cadastrar médico nesta clínica" : "Convidar"}
        </button>
        {msg && <p className="sm:col-span-2 text-sm text-[var(--gold)]">{msg}</p>}
        {err && <p className="sm:col-span-2 text-sm text-[var(--danger)]">{err}</p>}
      </form>

      <h2 className="mt-8 font-display text-xl font-bold">Vínculos ativos</h2>
      <div className="mt-2 space-y-2">
        {members.length === 0 && <p className="text-sm text-[var(--text-muted)]">Ninguém vinculado ainda.</p>}
        {members.map((m) => (
          <div key={m.id} className="panel">
            <p className="font-bold">{m.name}</p>
            <p className="text-sm text-[var(--text-soft)]">{m.email} · {m.role} · {m.actorKind}</p>
            {m.actorKind === "doctor" && (
              <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                {m.feeCents != null
                  ? `${brl(m.feeCents)} nesta clínica · ${m.clinicSharePercent ?? 0}% clínica`
                  : "Sem valor definido nesta clínica — cadastre na produção."}
              </p>
            )}
          </div>
        ))}
      </div>

      <h2 className="mt-8 font-display text-xl font-bold">Convites</h2>
      <div className="mt-2 space-y-2">
        {invites.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum convite.</p>}
        {invites.map((i) => (
          <div key={i.id} className="panel">
            <p className="font-bold">{i.name}</p>
            <p className="text-sm text-[var(--text-soft)]">{i.email} · {i.kind} · {i.status}</p>
            {i.kind === "doctor" && i.feeCents != null && (
              <p className="text-sm">{brl(i.feeCents)} · {i.clinicSharePercent ?? 0}% clínica (vale quando aceitar)</p>
            )}
            {i.status === "pending" && i.token && (
              <p className="mt-1 break-all text-xs text-[var(--gold)]">/convite/{i.token}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
