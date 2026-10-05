"use client";
import { ReturnInbox } from "@/components/ReturnInbox";
export default function Page() {
  return (
    <ReturnInbox
      detailBase="/nutricionista/solicitacoes"
      loginHref="/nutricionista/login"
      title="Solicitações de retorno"
      subtitle="O paciente solicita o retorno. Você valida a classificação antes de confirmar o horário."
      showPatient
    />
  );
}
