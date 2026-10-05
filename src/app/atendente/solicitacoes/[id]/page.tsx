"use client";
import { useParams } from "next/navigation";
import { ReturnRequestDetail } from "@/components/ReturnRequestDetail";
export default function Page() {
  const params = useParams<{ id: string }>();
  return <ReturnRequestDetail id={params.id} backHref="/atendente/solicitacoes" loginHref="/atendente/login" />;
}
