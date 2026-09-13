"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ClinicaHomePage() {
  const params = useParams<{ id: string }>();
  const [clinic, setClinic] = useState("");
  const [canAdmin, setCanAdmin] = useState(false);

  useEffect(() => {
    fetch(`/api/clinica/${params.id}/me`)
      .then((r) => r.json())
      .then((d) => {
        setClinic(d.clinic?.name || "");
        setCanAdmin(Boolean(d.staff?.canAdmin));
      })
      .catch(() => {});
  }, [params.id]);

  return (
    <div>
      <p className="text-sm font-semibold text-[var(--gold)]">Gestão da clínica</p>
      <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">{clinic || "Clínica"}</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--text-soft)]">
        Esta área não substitui o prontuário nem o painel médico. Pacientes atuais continuam no médico;
        nada aqui move cadastro antigo.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {canAdmin && (
          <>
            <Link href={`/clinica/${params.id}/equipe`} className="panel block">
              <p className="font-bold">Equipe</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Convidar médico ou atendente. Se a pessoa já existe, só vincula.</p>
            </Link>
            <Link href={`/clinica/${params.id}/financeiro`} className="panel block">
              <p className="font-bold">Produção</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Atendido ≠ recebido. Regra no vínculo médico↔clínica.</p>
            </Link>
          </>
        )}
        <Link href={`/clinica/${params.id}/caixa`} className="panel block">
          <p className="font-bold">Check-in</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Pago, pendente, cortesia, Pix, cartão ou dinheiro.</p>
        </Link>
      </div>
    </div>
  );
}
