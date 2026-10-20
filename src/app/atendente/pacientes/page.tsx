"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

type DoctorLink = { doctorId: string; doctorName: string; permissions: Record<string, boolean> };

function CriarPacienteInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [doctors, setDoctors] = useState<DoctorLink[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [form, setForm] = useState({ name: "", cpf: "", cns: "", motherName: "", birthdate: "", sex: "", phone: "", email: "", address: "" });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ id: string; name: string; reused?: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/atendente/me").then((r) => r.json());
      if (!me.attendant) { router.replace("/atendente/login"); return; }
      const list: DoctorLink[] = me.doctors || [];
      setDoctors(list);
      const fromUrl = search.get("doctorId") || "";
      setDoctorId(list.some((d) => d.doctorId === fromUrl) ? fromUrl : (list[0]?.doctorId || ""));
    })();
  }, [router, search]);

  const doctor = doctors.find((d) => d.doctorId === doctorId);
  const canCreate = !doctor || doctor.permissions?.criarPaciente !== false;

  async function submit() {
    setMsg("");
    if (!doctorId) { setMsg("Sem médico vinculado. Peça ao médico para te incluir em Minha equipe."); return; }
    if (!form.name.trim()) { setMsg("Informe o nome completo."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/atendente/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId, ...form }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok || (res.status === 409 && d.existingId)) {
        setDone({ id: d.id || d.existingId, name: d.name || form.name, reused: Boolean(d.linkedExisting || d.existingId) });
        return;
      }
      setMsg(d.error || "Não foi possível criar o paciente.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-2xl">✓</div>
        <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">{done.reused ? "Paciente disponível" : "Paciente criado"}</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          {done.reused
            ? `${done.name} já existia e ficou disponível para o médico${doctor ? ` ${doctor.doctorName}` : ""}.`
            : `${done.name} já está na lista do médico${doctor ? ` ${doctor.doctorName}` : ""}.`}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href={`/atendente/agendar?doctorId=${doctorId}`} className="btn-gold">Agendar consulta</Link>
          <button type="button" className="btn-ghost" onClick={() => { setDone(null); setForm({ name: "", cpf: "", cns: "", motherName: "", birthdate: "", sex: "", phone: "", email: "", address: "" }); }}>Criar outro</button>
          <Link href="/atendente/painel" className="btn-ghost">Painel</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pb-16 pt-8">
      <Link href="/atendente/painel" className="text-sm font-semibold text-[var(--gold)]">← Painel</Link>
      <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">Criar paciente</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">O cadastro fica no prontuário do médico. Depois você pode agendar.</p>

      {doctors.length === 0 && (
        <p className="panel mt-4 text-sm font-semibold text-[var(--danger)]">Nenhum médico vinculado. Peça ao médico para te adicionar em Minha equipe — Atendentes.</p>
      )}

      {doctors.length > 0 && (
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Médico</span>
          <select className="input-field" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            {doctors.map((d) => <option key={d.doctorId} value={d.doctorId}>{d.doctorName}</option>)}
          </select>
        </label>
      )}

      <div className="panel mt-4 grid gap-2 sm:grid-cols-2">
        <input className="input-field sm:col-span-2" placeholder="Nome completo *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input-field" placeholder="CPF" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} inputMode="numeric" />
        <input className="input-field" placeholder="Telefone / WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" />
        <input className="input-field" placeholder="E-mail (opcional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="input-field" type="date" value={form.birthdate} onChange={(e) => setForm({ ...form, birthdate: e.target.value })} />
        <select className="input-field" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
          <option value="">Sexo (opcional)</option>
          <option value="feminino">Feminino</option>
          <option value="masculino">Masculino</option>
        </select>
        <input className="input-field" placeholder="Cidade / região" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <input className="input-field" placeholder="CNS (Cartão SUS)" value={form.cns} onChange={(e) => setForm({ ...form, cns: e.target.value })} />
        <input className="input-field sm:col-span-2" placeholder="Nome da mãe" value={form.motherName} onChange={(e) => setForm({ ...form, motherName: e.target.value })} />
        <div className="sm:col-span-2">
          <button type="button" className="btn-gold" onClick={submit} disabled={saving || !canCreate || !doctorId}>
            {saving ? "Criando…" : "Criar paciente para o médico"}
          </button>
        </div>
      </div>
      {!canCreate && <p className="mt-3 text-sm font-semibold text-[var(--danger)]">Sem permissão para criar pacientes. Peça ao médico para ligar isso em Minha equipe.</p>}
      {msg && <p className="mt-3 text-sm font-semibold text-[var(--danger)]">{msg}</p>}
    </div>
  );
}

export default function AtendenteCriarPacientePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-5 py-16 text-[var(--text-muted)]">Carregando…</div>}>
      <CriarPacienteInner />
    </Suspense>
  );
}
