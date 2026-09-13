"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Member = { id: string; actorKind: string; role: string; status: string; name: string; email: string | null };
type Invite = { id: string; kind: string; name: string; email: string; status: string; token: string; createdAt: string };

export default function ClinicaEquipePage() {
  const params = useParams<{ id: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [kind, setKind] = useState<"doctor" | "attendant">("doctor");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [crm, setCrm] = useState("");
  const [specialty, setSpecialty] = useState("Nefrologia");
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
      const res = await fetch(`/api/clinica/${params.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name, email, crm, specialty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível convidar.");
      if (data.linkedExisting) {
        setMsg("Pessoa já existia — vinculada à clínica, sem nova conta e sem alterar senha.");
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
        A gestora não cria senha. Médico já cadastrado entra com o mesmo login. Pacientes não são migrados.
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
          </>
        )}
        <button type="submit" className="btn-gold sm:col-span-2" disabled={saving}>
          {saving ? "Enviando…" : "Convidar"}
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
          </div>
        ))}
      </div>
    </div>
  );
}
