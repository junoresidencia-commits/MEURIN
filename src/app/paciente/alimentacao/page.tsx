"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PatientNav } from "@/components/PatientNav";

type FoodLog = { id: string; food: string; meal?: string | null; quantity?: string | null; loggedAt: string };

type Nutrient = "fosforo" | "potassio" | "sodio" | "calcio" | "proteina";

const GUIDE: Record<Nutrient, { label: string; items: { name: string; note: string; level: "high" | "med" | "low" }[] }> = {
  fosforo: {
    label: "Fósforo",
    items: [
      { name: "Refrigerantes tipo cola", note: "Aditivos fosfatados", level: "high" },
      { name: "Embutidos (presunto, salsicha)", note: "Sódio e aditivos", level: "high" },
      { name: "Queijos processados", note: "Fósforo e sódio", level: "high" },
      { name: "Maçã", note: "Geralmente mais leve", level: "low" },
      { name: "Arroz branco", note: "Porção habitual", level: "low" },
    ],
  },
  potassio: {
    label: "Potássio",
    items: [
      { name: "Banana", note: "Teor mais alto", level: "high" },
      { name: "Água de coco", note: "Rico em potássio", level: "high" },
      { name: "Batata (sem remolho)", note: "Reduz com cocção em água", level: "med" },
      { name: "Maçã e pera", note: "Opções mais leves", level: "low" },
    ],
  },
  sodio: {
    label: "Sódio",
    items: [
      { name: "Temperos prontos e caldos", note: "Muito sódio", level: "high" },
      { name: "Enlatados", note: "Conservados em sal", level: "high" },
      { name: "Ervas frescas", note: "Alternativa ao sal", level: "low" },
    ],
  },
  calcio: {
    label: "Cálcio",
    items: [
      { name: "Leite e derivados", note: "Depende do plano", level: "med" },
      { name: "Sardinha", note: "Fonte de cálcio", level: "med" },
      { name: "Folhas verdes", note: "Varia conforme o caso", level: "low" },
    ],
  },
  proteina: {
    label: "Proteína",
    items: [
      { name: "Carnes e ovos", note: "Quantidade conforme orientação", level: "med" },
      { name: "Leguminosas", note: "Proteína vegetal", level: "med" },
    ],
  },
};

const BADGE: Record<string, string> = {
  high: "bg-[#fff0ee] text-[#c04b46]",
  med: "bg-[#fff7e8] text-[#a47114]",
  low: "bg-[#eaf8f2] text-[#1c8c70]",
};
const BADGE_LABEL: Record<string, string> = { high: "Alto", med: "Médio", low: "Baixo" };

export default function AlimentacaoPage() {
  const router = useRouter();
  const [food, setFood] = useState<FoodLog[]>([]);
  const [tab, setTab] = useState<Nutrient>("fosforo");
  const [name, setName] = useState("");
  const [meal, setMeal] = useState("Almoço");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/patient/records");
    if (res.status === 401) {
      router.replace("/paciente/entrar?next=/paciente/alimentacao");
      return;
    }
    const data = await res.json();
    setFood(data.food || []);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function addFood() {
    if (!name.trim()) {
      setError("Informe o alimento ou refeição.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/patient/food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ food: name, meal, quantity }),
      });
      if (res.status === 401) {
        router.replace("/paciente/entrar?next=/paciente/alimentacao");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível adicionar.");
      setName("");
      setQuantity("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[560px] px-5 pb-28 pt-8">
      <Link href="/paciente/inicio" className="text-sm font-semibold text-[var(--gold)]">
        ← Início
      </Link>
      <h1 className="font-display mt-3 text-2xl font-extrabold text-[var(--text)]">
        Diário alimentar
      </h1>

      {/* Alerta educativo, não genérico */}
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[var(--warn)]/30 bg-[#fff7e8] p-4">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-[#a47114]">!</span>
        <p className="text-sm text-[#7a5a12]">
          <strong>Aviso educativo.</strong> A necessidade de restringir potássio,
          fósforo, sódio ou cálcio depende dos seus exames, do diagnóstico e da
          orientação da sua equipe. Este guia não substitui o plano individual do
          seu médico ou nutricionista.
        </p>
      </div>

      {/* Registro de alimento */}
      <div className="panel mt-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
          Registrar alimento
        </p>
        <input
          className="input-field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: banana, feijão, presunto, leite..."
        />
        <div className="grid grid-cols-2 gap-3">
          <select className="input-field" value={meal} onChange={(e) => setMeal(e.target.value)}>
            <option>Café da manhã</option>
            <option>Almoço</option>
            <option>Lanche</option>
            <option>Jantar</option>
          </select>
          <input
            className="input-field"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="1 unidade, 2 colheres"
          />
        </div>
        {error && (
          <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
        <button type="button" className="btn-gold w-full" onClick={addFood} disabled={loading}>
          {loading ? "Adicionando…" : "Adicionar ao diário"}
        </button>
      </div>

      {/* Alimentos registrados */}
      {food.length > 0 && (
        <div className="panel mt-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
            Registrado recentemente
          </p>
          {food.slice(0, 6).map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
              <div>
                <p className="font-semibold text-[var(--text)]">{f.food}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {[f.meal, f.quantity].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Guia educativo */}
      <p className="mt-8 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
        Guia alimentar
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(GUIDE) as Nutrient[]).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setTab(n)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
              tab === n
                ? "bg-[var(--gold)] text-white"
                : "border border-[var(--border)] bg-white text-[var(--text-soft)]"
            }`}
          >
            {GUIDE[n].label}
          </button>
        ))}
      </div>
      <div className="panel mt-3 space-y-3">
        {GUIDE[tab].items.map((item) => (
          <div key={item.name} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] p-3">
            <div className="flex-1">
              <p className="font-semibold text-[var(--text)]">{item.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{item.note}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${BADGE[item.level]}`}>
              {BADGE_LABEL[item.level]}
            </span>
          </div>
        ))}
      </div>

      <PatientNav />
    </div>
  );
}
