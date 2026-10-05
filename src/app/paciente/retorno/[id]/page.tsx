"use client";

import { useParams } from "next/navigation";
import { PatientNav } from "@/components/PatientNav";
import { ReturnRequestDetail } from "@/components/ReturnRequestDetail";

export default function PacienteRetornoPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="min-h-screen bg-[var(--bg)] pb-16">
      <ReturnRequestDetail
        id={params.id}
        backHref="/paciente/atendimentos"
        loginHref={`/paciente/entrar?next=/paciente/retorno/${params.id}`}
      />
      <PatientNav />
    </div>
  );
}
