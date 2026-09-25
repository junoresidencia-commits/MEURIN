"use client";

import { useEffect, useState } from "react";
import { useHd } from "@/components/hd/HdShell";
import { HD_EXAM_LABEL } from "@/lib/hd-labels";
import { HD_EXAM_CODES, type HdExamCode } from "@/lib/hd-types";

type Rule = { code: string; domain: string; version: string; source: string; condition: string; classification: string; suggestion: string; date: string };

export default function HdConfigPage() {
  const { can } = useHd();
  const [name, setName] = useState("");
  const [expected, setExpected] = useState<HdExamCode[]>([...HD_EXAM_CODES]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/hemodialise?view=settings").then((r) => r.json()).then((d) => {
      setName(d.settings?.centerName || d.unit?.name || "");
      setExpected(d.settings?.expectedExams || [...HD_EXAM_CODES]);
      setRules(d.rules || []);
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/hemodialise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_settings", centerName: name, unitName: name, expectedExams: expected }),
    });
    const d = await r.json();
    setMsg(d.error || "Configurações salvas.");
  }

  if (!can("manage_config")) return <p>Somente o administrador configura turnos, máquinas e protocolos.</p>;

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">Configurações</h2>
      <form onSubmit={save} className="panel mt-4 grid gap-3">
        <label className="text-sm">Nome do centro
          <input className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <p className="font-bold">Exames esperados no mês</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {HD_EXAM_CODES.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={expected.includes(c)}
                onChange={(e) => setExpected(e.target.checked ? [...expected, c] : expected.filter((x) => x !== c))}
              />
              {HD_EXAM_LABEL[c]}
            </label>
          ))}
        </div>
        <button className="btn-gold w-fit" type="submit">Salvar</button>
        {msg && <p className="text-sm text-[var(--gold)]">{msg}</p>}
      </form>
      <div className="panel mt-6">
        <p className="font-display text-lg font-bold">Motor de regras</p>
        <p className="text-sm text-[var(--text-muted)]">Determinístico, com código, domínio, versão e fonte. Separado da IA.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-[var(--text-muted)]">
                <th className="px-2 py-2 text-left">Código</th>
                <th className="px-2 py-2 text-left">Domínio</th>
                <th className="px-2 py-2 text-left">Fonte</th>
                <th className="px-2 py-2 text-left">Condição</th>
                <th className="px-2 py-2 text-left">Classe</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.code} className="border-t border-[var(--border)]">
                  <td className="px-2 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-2 py-2">{r.domain}</td>
                  <td className="px-2 py-2">{r.source} v{r.version}</td>
                  <td className="px-2 py-2">{r.condition}</td>
                  <td className="px-2 py-2">{r.classification}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
