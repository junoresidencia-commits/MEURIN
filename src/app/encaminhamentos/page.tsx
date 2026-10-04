"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReferralInbox } from "@/components/ReferralInbox";

export default function EncaminhamentosRedePage() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    fetch("/api/network/referrals").then((r) => setOk(r.ok));
  }, []);
  if (!ok) {
    return <div className="mx-auto max-w-2xl px-5 py-16 text-sm text-[var(--text-muted)]">Entre como profissional para ver os encaminhamentos.</div>;
  }
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/rede" className="text-sm font-semibold text-[var(--gold)]">← Rede de profissionais</Link>
      <div className="mt-4">
        <ReferralInbox />
      </div>
    </div>
  );
}
