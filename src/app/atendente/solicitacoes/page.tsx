"use client";
import { ReturnInbox } from "@/components/ReturnInbox";
export default function Page() {
  return (
    <ReturnInbox
      detailBase="/atendente/solicitacoes"
      loginHref="/atendente/login"
      title="Solicitações encaminhadas"
      subtitle="Atendimentos em que o profissional pediu sua participação para horário, local ou pagamento."
      showPatient
    />
  );
}
