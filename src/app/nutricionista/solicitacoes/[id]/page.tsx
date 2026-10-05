"use client";
import { useParams } from "next/navigation";
import { ReturnRequestDetail } from "@/components/ReturnRequestDetail";
export default function Page() {
  const params = useParams<{ id: string }>();
  return <ReturnRequestDetail id={params.id} backHref="/nutricionista/solicitacoes" loginHref="/nutricionista/login" />;
}
