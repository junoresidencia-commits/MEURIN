"use client";

import { useEffect, useState } from "react";
import { useHd } from "@/components/hd/HdShell";
import { HdPatientIdsForm } from "@/components/hd/HdPatientIdsForm";
import { CfmPdfActions } from "@/components/CfmPdfActions";

type Pack = {
  protocolId: string;
  protocolName: string;
  cid10: string;
  diagnosis: string;
  ready: boolean;
  reasons: string[];
  warnings: string[];
  medications: { medId: string; name: string; presentation: string; monthlyQty: string }[];
};

type Preview = {
  hdPatientId: string;
  hdPatientName: string;
  linked: { id: string; name: string; key: string; cns: string | null; cpf: string | null } | null;
  establishment: { id: string; name: string; cnes: string } | null;
  locations: Array<{ id: string; name: string; cnes: string }>;
  suggestion: {
    hasLabs: boolean;
    labsText: string;
    opinion: string[];
    packages: Pack[];
    warnings: string[];
    canGenerate: boolean;
  };
  blockers: string[];
  canGenerate: boolean;
  cadastro?: {
    cpf: string;
    cns: string;
    motherName: string;
    clinicCnes: string;
    clinicName: string;
    doctorCns: string;
  };
};

type Generated = {
  lmeId: string;
  protocolName: string;
  href: string;
  receitaId?: string | null;
  receitaUrl: string | null;
  relatorioId?: string | null;
  relatorioUrl: string | null;
  terId?: string | null;
  terUrl: string | null;
};

export function HdExamDocsPanel({
  patientId,
  compact,
  tick,
}: {
  patientId?: string;
  compact?: boolean;
  tick?: number;
}) {
  const { year, month, can } = useHd();
  const [items, setItems] = useState<Preview[]>([]);
  const [mine, setMine] = useState<Array<{ id: string; name: string }>>([]);
  const [linkFor, setLinkFor] = useState<Record<string, string>>({});
  const [locFor, setLocFor] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState<Record<string, Generated[]>>({});

  async function load() {
    const u = new URLSearchParams({ view: "docs_from_exams", year: String(year), month: String(month) });
    if (patientId) u.set("id", patientId);
    const [d, p] = await Promise.all([
      fetch(`/api/hemodialise?${u}`).then((r) => r.json()),
      fetch("/api/hemodialise?view=meurim-patients").then((r) => r.json()),
    ]);
    const list: Preview[] = patientId ? (d.error ? [] : [d]) : d.items || [];
    setItems(list);
    setMine(p.patients || []);
  }
  useEffect(() => { void load(); }, [year, month, patientId, tick]);

  async function generate(p: Preview) {
    setBusy(p.hdPatientId);
    setMsg("");
    const r = await fetch("/api/hemodialise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate_docs_from_exams",
        patientId: p.hdPatientId,
        year,
        month,
        meuRimPatientId: linkFor[p.hdPatientId] || p.linked?.id,
        locationId: locFor[p.hdPatientId] || p.establishment?.id,
      }),
    });
    const d = await r.json();
    setBusy("");
    if (d.error) {
      setMsg(d.error);
      return;
    }
    setMsg(d.note || "Pacote gerado.");
    setDone((prev) => ({ ...prev, [p.hdPatientId]: d.generated || [] }));
    await load();
  }

  if (items.length === 0) return null;

  return (
    <div className={compact ? "space-y-3" : "mt-6 space-y-4"}>
      {!compact && (
        <div>
          <h3 className="font-display text-xl font-extrabold">Opinião e LME após os exames</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Publiquei o PDF ou a foto: o protocolo já diz o que revisar e monta a LME oficial (CNS, CNES, medicamento CEAF e quantidade do mapa).
            Não inventa ampola nem sulfato ferroso oral. O médico confirma.
          </p>
        </div>
      )}
      {items.map((p) => (
        <article key={p.hdPatientId} className="panel space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-bold">{p.hdPatientName}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {p.linked
                  ? `Meu Rim: ${p.linked.name}${p.cadastro?.cns ? ` · CNS ${p.cadastro.cns}` : " · sem Cartão do SUS"}`
                  : "Cadastre CPF, Cartão do SUS e nome da mãe neste paciente"}
                {p.cadastro?.clinicCnes
                  ? ` · ${p.cadastro.clinicName} · CNES ${p.cadastro.clinicCnes}`
                  : p.establishment
                    ? ` · ${p.establishment.name} · CNES ${p.establishment.cnes}`
                    : " · sem CNES da clínica"}
                {p.cadastro?.doctorCns ? ` · médico CNS ${p.cadastro.doctorCns}` : " · CNS do médico ainda não cadastrado"}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Opinião do protocolo</p>
            <ul className="mt-1 space-y-1 text-sm">
              {p.suggestion.opinion.map((o) => <li key={o}>{o}</li>)}
            </ul>
            {p.suggestion.labsText && (
              <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-[var(--bg-soft)] px-3 py-2 text-xs">{p.suggestion.labsText}</pre>
            )}
          </div>

          {p.suggestion.packages.map((pack) => (
            <div key={pack.protocolId} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
              <p className="font-semibold">{pack.protocolName}</p>
              <p className="text-xs text-[var(--text-muted)]">CID {pack.cid10} — {pack.diagnosis}</p>
              {pack.medications.length === 0 && <p className="mt-1 text-xs text-[var(--warn)]">Sem medicamento oficial ainda.</p>}
              {pack.medications.map((m) => (
                <p key={m.medId} className="mt-1">
                  {m.name} ({m.presentation}) — <strong>{m.monthlyQty || "quantidade: médico preenche"}</strong>
                </p>
              ))}
              {pack.warnings.map((w) => <p key={w} className="mt-1 text-xs text-[var(--warn)]">{w}</p>)}
            </div>
          ))}

          {(!p.cadastro?.cpf || !p.cadastro?.cns || !p.cadastro?.motherName) && (
            <div className="rounded-xl border border-[var(--border)] px-3 py-3">
              <p className="text-sm font-semibold">Cadastrar dados da LME</p>
              <p className="text-xs text-[var(--text-muted)]">CPF, Cartão do SUS e nome da mãe. O CNES da clínica e o CNS do médico ficam em Configurações.</p>
              <div className="mt-2">
                <HdPatientIdsForm
                  patientId={p.hdPatientId}
                  initial={{ cpf: p.cadastro?.cpf, cns: p.cadastro?.cns, motherName: p.cadastro?.motherName }}
                  onSaved={() => void load()}
                />
              </div>
            </div>
          )}
          {!p.linked && (
            <label className="block text-sm">
              Vincular ao paciente do Meu Rim
              <select
                className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2"
                value={linkFor[p.hdPatientId] || ""}
                onChange={(e) => setLinkFor((prev) => ({ ...prev, [p.hdPatientId]: e.target.value }))}
              >
                <option value="">Selecione</option>
                {mine.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
          )}
          {p.locations.length > 1 && (
            <label className="block text-sm">
              Local / CNES
              <select
                className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2"
                value={locFor[p.hdPatientId] || p.establishment?.id || ""}
                onChange={(e) => setLocFor((prev) => ({ ...prev, [p.hdPatientId]: e.target.value }))}
              >
                {p.locations.map((l) => <option key={l.id} value={l.id}>{l.name} — CNES {l.cnes}</option>)}
              </select>
            </label>
          )}

          {p.blockers.map((b) => <p key={b} className="text-xs text-[var(--warn)]">{b}</p>)}
          {p.suggestion.warnings.map((w) => <p key={w} className="text-xs text-[var(--text-muted)]">{w}</p>)}

          {can("review") && (
            <button
              type="button"
              className="btn-gold"
              disabled={Boolean(busy) || (!p.canGenerate && !linkFor[p.hdPatientId])}
              onClick={() => void generate(p)}
            >
              {busy === p.hdPatientId ? "Gerando…" : "Gerar LME, receita e termos"}
            </button>
          )}

          {(done[p.hdPatientId] || []).map((g) => (
            <div key={g.lmeId} className="space-y-3 text-sm">
              <p className="font-semibold">{g.protocolName}</p>
              <div>
                <p>
                  <b>LME</b> — <a className="text-[var(--gold)]" href={g.href} target="_blank" rel="noreferrer">conferir</a>
                </p>
                <CfmPdfActions
                  compact
                  pdfHref={`/api/lme/${g.lmeId}/oficial?flatten=1`}
                  filename="lme-oficial.pdf"
                  title={`LME — ${p.hdPatientName}`}
                  documentType="lme"
                  patientKey={p.linked?.key}
                />
              </div>
              {g.receitaUrl ? (
                <div>
                  <p>
                    <b>Receita</b> — <a className="text-[var(--gold)]" href={g.receitaUrl} target="_blank" rel="noreferrer">conferir</a>
                  </p>
                  <CfmPdfActions
                    compact
                    pdfHref={g.receitaUrl}
                    documentId={g.receitaId}
                    filename="receita-meurim.pdf"
                    title="Receita médica"
                    documentType="receita"
                    patientKey={p.linked?.key}
                  />
                </div>
              ) : null}
              {g.relatorioUrl ? (
                <div>
                  <p>
                    <b>Relatório</b> — <a className="text-[var(--gold)]" href={g.relatorioUrl} target="_blank" rel="noreferrer">conferir</a>
                  </p>
                  <CfmPdfActions
                    compact
                    pdfHref={g.relatorioUrl}
                    documentId={g.relatorioId}
                    filename="relatorio-meurim.pdf"
                    title="Relatório médico"
                    documentType="relatorio"
                    patientKey={p.linked?.key}
                  />
                </div>
              ) : null}
              {g.terUrl ? (
                <div>
                  <p>
                    <b>TER</b> — <a className="text-[var(--gold)]" href={g.terUrl} target="_blank" rel="noreferrer">conferir</a>
                  </p>
                  <CfmPdfActions
                    compact
                    pdfHref={g.terUrl}
                    documentId={g.terId}
                    filename="ter-oficial.pdf"
                    title="TER oficial"
                    documentType="ter"
                    patientKey={p.linked?.key}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </article>
      ))}
      {msg && <p className="text-sm text-[var(--gold)]">{msg}</p>}
    </div>
  );
}
