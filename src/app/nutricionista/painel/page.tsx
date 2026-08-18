"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Me = { nutritionist: { name: string; crn?: string | null; uf?: string | null; specialty?: string | null }; doctors: { id: string; name: string }[] };
type Patient = { key: string; name: string; cpf: string | null; doctorId: string };
type Referral = { id: string; patientKey: string; patientName?: string | null; reason?: string | null; objective?: string | null; priority: string; status: string; doctorName?: string | null; createdAt: string };

export default function NutricionistaPainelPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const meRes = await fetch("/api/nutricionista/me");
    if (meRes.status === 401) { router.replace("/nutricionista/login"); return; }
    const meData = await meRes.json();
    setMe(meData);
    const pRes = await fetch("/api/nutricionista/patients");
    const pData = await pRes.json();
    setPatients(pData.patients || []);
    setReferrals(pData.referrals || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await fetch("/api/nutricionista/session", { method: "DELETE" });
    router.push("/nutricionista/login");
  }

  const openReferrals = referrals.filter((r) => r.status === "aberto");
  const filtered = q ? patients.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || (p.cpf || "").includes(q)) : patients;

  if (loading) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Nutrição Renal</p>
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Olá, {me?.nutritionist.name?.split(" ")[0]} 🥗</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {me?.nutritionist.crn ? `CRN ${me.nutritionist.crn}${me.nutritionist.uf ? "-" + me.nutritionist.uf : ""} · ` : ""}
            Vinculada a {me?.doctors.length || 0} médico(s): {me?.doctors.map((d) => d.name).join(", ") || "—"}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={logout}>Sair</button>
      </div>

      {/* Encaminhamentos abertos */}
      <section className="mt-8">
        <h2 className="font-display text-xl text-[var(--text)]">Encaminhamentos</h2>
        {openReferrals.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum encaminhamento em aberto.</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {openReferrals.map((r) => (
              <Link key={r.id} href={`/nutricionista/paciente/${encodeURIComponent(r.patientKey)}?ref=${r.id}`} className="panel flex flex-wrap items-center justify-between gap-2 transition hover:border-[var(--border-gold)]">
                <div>
                  <p className="font-semibold text-[var(--text)]">
                    {r.patientName || "Paciente"}
                    {r.priority === "alta" && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">Prioridade alta</span>}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">{r.reason || "Encaminhamento nutricional"}{r.objective ? ` — ${r.objective}` : ""}</p>
                  <p className="text-xs text-[var(--text-muted)]">Encaminhado por {r.doctorName || "médico"}</p>
                </div>
                <span className="text-[var(--gold)]">Abrir →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Pacientes */}
      <section className="mt-8">
        <h2 className="font-display text-xl text-[var(--text)]">Pacientes</h2>
        <input className="input-field mt-3" placeholder="Buscar por nome ou CPF" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-3 grid gap-2">
          {filtered.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum paciente encontrado.</p>}
          {filtered.map((p) => (
            <Link key={p.key} href={`/nutricionista/paciente/${encodeURIComponent(p.key)}`} className="panel flex items-center justify-between transition hover:border-[var(--border-gold)]">
              <div>
                <p className="font-semibold text-[var(--text)]">{p.name}</p>
                {p.cpf && <p className="text-xs text-[var(--text-muted)]">CPF {p.cpf}</p>}
              </div>
              <span className="text-[var(--gold)]">Abrir →</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
