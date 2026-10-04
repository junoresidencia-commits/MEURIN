import "server-only";
import { listDoctors } from "./store";
import { listAllNutritionists } from "./nutritionists-store";
import { listAlliedProfessionals } from "./allied-store";
import { alliedPublicCard, doctorPublicCard, nutritionPublicCard } from "./network-actor";
import { isProfessionalKind, type ProfessionalKind, type ProfessionalPublicCard } from "./network-types";

function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function haystack(card: ProfessionalPublicCard): string {
  return norm(
    [card.name, card.professionalName, card.profession, card.specialty, card.registry, card.rqe, card.city, card.state, card.clinic]
      .filter(Boolean)
      .join(" ")
  );
}

export interface ProfessionalSearchQuery {
  q?: string;
  profession?: string;
  specialty?: string;
  city?: string;
  state?: string;
  clinic?: string;
  kind?: ProfessionalKind;
  excludeKind?: ProfessionalKind;
  excludeId?: string;
  limit?: number;
}

/** Busca qualquer profissional aprovado/ativo da plataforma. Sem CPF, PIX ou dados privados. */
export async function searchNetworkProfessionals(query: ProfessionalSearchQuery): Promise<ProfessionalPublicCard[]> {
  const q = norm(query.q || "");
  const profession = norm(query.profession || "");
  const specialty = norm(query.specialty || "");
  const city = norm(query.city || "");
  const state = norm(query.state || "");
  const clinic = norm(query.clinic || "");
  const limit = Math.min(Math.max(query.limit ?? 40, 1), 80);
  const hasFilter = Boolean(q || profession || specialty || city || state || clinic || query.kind);
  if (!hasFilter) return [];

  const cards: ProfessionalPublicCard[] = [];

  if (!query.kind || query.kind === "doctor") {
    const doctors = await listDoctors();
    for (const d of doctors) {
      if ((d.status ?? "approved") !== "approved") continue;
      cards.push(doctorPublicCard(d));
    }
  }
  if (!query.kind || query.kind === "nutrition") {
    try {
      const nuts = await listAllNutritionists();
      for (const n of nuts) {
        if (n.status !== "active") continue;
        cards.push(nutritionPublicCard(n));
      }
    } catch (err) {
      console.error("[network] nutricionistas na busca", err);
    }
  }
  if (!query.kind || query.kind === "psychology" || query.kind === "nursing") {
    try {
      const allied = await listAlliedProfessionals(query.kind === "psychology" || query.kind === "nursing" ? query.kind : undefined);
      for (const p of allied) {
        if (p.status !== "active") continue;
        if (query.kind && p.role !== query.kind) continue;
        cards.push(alliedPublicCard(p));
      }
    } catch (err) {
      console.error("[network] equipe assistencial na busca", err);
    }
  }

  return cards
    .filter((c) => !(query.excludeId && c.id === query.excludeId && c.kind === (query.excludeKind || c.kind)))
    .filter((c) => {
      if (profession && !norm(c.profession).includes(profession) && !norm(c.kind).includes(profession)) return false;
      if (specialty && !norm(c.specialty).includes(specialty)) return false;
      if (city && !norm(c.city || "").includes(city)) return false;
      if (state && !norm(c.state || "").includes(state)) return false;
      if (clinic && !norm(c.clinic || "").includes(clinic)) return false;
      if (q && !haystack(c).includes(q)) return false;
      return true;
    })
    .slice(0, limit);
}

export function parseKindParam(value: string | null): ProfessionalKind | undefined {
  return isProfessionalKind(value) ? value : undefined;
}
