"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Doctor = { id: string; name: string; specialty: string; role: string };
type Referral = {
  id: string;
  patientName: string | null;
  patientKey: string;
  fromDoctorName: string | null;
  fromSpecialty: string | null;
  toDoctorName: string | null;
  toSpecialty: string | null;
  reason: string | null;
  status: string;
  createdAt: string;
};

export default function ClinicaRedePage() {
  const params = useParams<{ id: string }>();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [linked, setLinked] = useState(0);

  useEffect(() => {
    fetch(`/api/clinica/${params.id}/referrals`)
      .then((r) => r.json())
      .then((d) => {
        setDoctors(d.doctors || []);
        setReferrals(d.referrals || []);
        setLinked(Number(d.linkedPatients || 0));
      })
      .catch(() => {});
  }, [params.id]);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Rede de cuidado</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Encaminhamento entre médicos desta clínica. O prontuário é o mesmo; o cadastro não muda de médico.
        Pacientes antigos só entram nesta lista se alguém encaminhar — não há migração em lote.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="panel">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Médicos na clínica</p>
          <p className="mt-1 font-display text-3xl font-extrabold">{doctors.length}</p>
        </div>
        <div className="panel">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Vínculos pontuais</p>
          <p className="mt-1 font-display text-3xl font-extrabold">{linked}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Só quem foi encaminhado aqui. Sem backfill.</p>
        </div>
      </div>

      <h2 className="mt-8 text-lg font-bold text-[var(--text)]">Equipe médica</h2>
      <div className="mt-3 grid gap-3">
        {doctors.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum médico vinculado ainda.</p>}
        {doctors.map((d) => (
          <div key={d.id} className="panel">
            <p className="font-bold text-[var(--text)]">{d.name}</p>
            <p className="text-sm text-[var(--text-muted)]">
              {d.specialty || "Medicina"} · {d.role === "ADMIN_CLINICA" ? "Gestora" : "Médico"}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-bold text-[var(--text)]">Encaminhamentos intra-clínica</h2>
      <div className="mt-3 grid gap-3">
        {referrals.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">
            Ainda não há encaminhamento nesta clínica. O médico encaminha pelo prontuário, como já fazia.
          </p>
        )}
        {referrals.map((r) => (
          <div key={r.id} className="panel">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
              {r.status === "active" ? "Ativo" : "Encerrado"} · {new Date(r.createdAt).toLocaleString("pt-BR")}
            </p>
            <p className="font-display text-lg font-bold text-[var(--text)]">{r.patientName || "Paciente"}</p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              De: {r.fromDoctorName} {r.fromSpecialty ? `— ${r.fromSpecialty}` : ""}
            </p>
            <p className="text-sm text-[var(--text-soft)]">
              Para: {r.toDoctorName} {r.toSpecialty ? `— ${r.toSpecialty}` : ""}
            </p>
            {r.reason && (
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                <b>Motivo:</b> {r.reason}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
