"use client";

import { useParams } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { NotificationBell } from "@/components/NotificationBell";
import { ReturnRequestDetail } from "@/components/ReturnRequestDetail";

export default function MedicoSolicitacaoPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="flex justify-end px-5 pt-6">
          <NotificationBell />
        </div>
        <ReturnRequestDetail
          id={params.id}
          backHref="/medicos/solicitacoes"
          loginHref="/medicos/login"
        />
      </div>
      <DoctorMobileNav />
    </div>
  );
}
