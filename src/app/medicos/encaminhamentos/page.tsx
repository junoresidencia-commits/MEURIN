"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";

type Share = {
  id: string;
  patientKey: string;
  patientName: string | null;
  fromDoctorName: string | null;
  fromSpecialty: string | null;
  toDoctorName: string | null;
  toSpecialty: string | null;
  reason: string | null;
  status: string;
  createdAt: string;
};

export default function EncaminhamentosPage() {
  const router = useRouter();
  const [incoming, setIncoming] = useState<Share[]>([]);
  const [outgoing, setOutgoing] = useState<Share[]>([]);
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => {
      if (!d.doctor) { router.replace("/medicos/login"); return; }
      fetch("/api/doctor/shares").then((r) => r.json()).then((x) => {
        setIncoming(x.incoming || []);
        setOutgoing(x.outgoing || []);
      });
    });
  }, [router]);

  const list = tab === "incoming" ? incoming : outgoing;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl px-5 pb-28 pt-8 lg:pb-8">
          <p className="text-sm font-semibold text-[var(--gold)]">Médico</p>
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Encaminhamentos</h1>
          <p className="mt-1 text-[var(--text-muted)]">Pacientes compartilhados com você e os que você encaminhou. O prontuário é o mesmo.</p>

          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setTab("incoming")} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === "incoming" ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white"}`}>Recebidos</button>
            <button type="button" onClick={() => setTab("outgoing")} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === "outgoing" ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white"}`}>Enviados</button>
          </div>

          <div className="mt-5 grid gap-3">
            {list.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum encaminhamento nesta lista.</p>}
            {list.map((s) => (
              <div key={s.id} className="panel">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
                  {s.status === "active" ? "Ativo" : "Acesso removido"} · {new Date(s.createdAt).toLocaleString("pt-BR")}
                </p>
                <p className="font-display text-lg font-bold text-[var(--text)]">{s.patientName || s.patientKey}</p>
                <p className="mt-1 text-sm text-[var(--text-soft)]">
                  Encaminhado por: {s.fromDoctorName} {s.fromSpecialty ? `— ${s.fromSpecialty}` : ""}
                </p>
                <p className="text-sm text-[var(--text-soft)]">
                  Para: {s.toDoctorName} {s.toSpecialty ? `— ${s.toSpecialty}` : ""}
                </p>
                {s.reason && <p className="mt-2 text-sm text-[var(--text-soft)]"><b>Motivo:</b> {s.reason}</p>}
                {s.status === "active" && (
                  <Link href={`/medicos/paciente/${encodeURIComponent(s.patientKey)}`} className="btn-gold mt-3 inline-flex text-sm">
                    Abrir prontuário
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}
