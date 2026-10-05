"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Pro = {
  kind: string;
  id: string;
  displayName: string;
  specialty: string;
  photoUrl?: string | null;
  bio?: string | null;
  consultationPriceCents: number;
};

export default function ProfessionalProfilePage() {
  const params = useParams<{ kind: string; id: string }>();
  const [pro, setPro] = useState<Pro | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/professionals/${params.kind}/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setPro(d.professional);
      })
      .catch(() => setError("Não foi possível carregar o profissional."));
  }, [params.kind, params.id]);

  if (error) return <div className="mx-auto max-w-lg px-5 py-16 text-sm text-[var(--danger)]">{error}</div>;
  if (!pro) return <div className="mx-auto max-w-lg px-5 py-16 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="mx-auto max-w-lg px-5 py-10">
      <Link href="/agendar" className="text-sm font-semibold text-[var(--gold)]">← Profissionais</Link>
      <div className="panel mt-4 flex items-start gap-4">
        {pro.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pro.photoUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--gold-soft)] text-lg font-extrabold text-[var(--gold)]">
            {pro.displayName.split(" ").slice(0, 2).map((p) => p[0]).join("")}
          </span>
        )}
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">{pro.displayName}</h1>
          <p className="text-sm text-[var(--gold)]">{pro.specialty}</p>
          {pro.bio && <p className="mt-2 text-sm text-[var(--text-muted)]">{pro.bio}</p>}
        </div>
      </div>
      <Link href={`/paciente/agendar/${pro.kind}/${pro.id}`} className="btn-gold mt-6 inline-flex w-full justify-center">
        Agendar atendimento
      </Link>
    </div>
  );
}
