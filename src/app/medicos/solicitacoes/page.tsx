"use client";

import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { ReturnInbox } from "@/components/ReturnInbox";

export default function MedicoSolicitacoesPage() {
  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <ReturnInbox
          detailBase="/medicos/solicitacoes"
          loginHref="/medicos/login"
          title="Solicitações de retorno"
          subtitle="O paciente solicita. Você valida. O horário só é reservado depois da sua confirmação — retorno não é gratuito só porque o paciente escolheu essa opção."
          showPatient
        />
      </div>
      <DoctorMobileNav />
    </div>
  );
}
