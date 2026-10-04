import "server-only";
import { getDoctorSessionId } from "./auth";
import { getDoctorById } from "./store";
import { getNutritionistId } from "./nutrition-session";
import { getNutritionist } from "./nutritionists-store";
import { getAlliedSessionId } from "./allied-session";
import { getAlliedProfessional } from "./allied-store";
import { ROLE_META } from "./allied-types";
import {
  honorific,
  PROFESSION_LABELS,
  type NetworkActor,
  type ProfessionalKind,
  type ProfessionalPublicCard,
} from "./network-types";
import type { Doctor } from "./types";
import type { Nutritionist } from "./nutritionists-store";
import type { AlliedProfessional } from "./allied-types";

export function doctorPublicCard(d: Doctor): ProfessionalPublicCard {
  const city =
    d.city ||
    d.locations?.find((l) => l.active && l.city)?.city ||
    null;
  const state = d.state || d.crmState || null;
  const clinic =
    d.clinic ||
    d.locations?.find((l) => l.active)?.name ||
    null;
  return {
    id: d.id,
    kind: "doctor",
    name: d.name,
    professionalName: d.professionalName || d.name,
    profession: d.profession || PROFESSION_LABELS.doctor,
    specialty: d.specialty || "",
    registry: d.crm ? `CRM ${d.crm}${d.crmState ? `/${d.crmState}` : ""}` : null,
    rqe: d.rqe || null,
    city,
    state,
    clinic,
    photoUrl: d.photoUrl || null,
    bio: d.bio || null,
  };
}

export function nutritionPublicCard(n: Nutritionist): ProfessionalPublicCard {
  return {
    id: n.id,
    kind: "nutrition",
    name: n.name,
    professionalName: n.name,
    profession: PROFESSION_LABELS.nutrition,
    specialty: n.specialty || "Nutrição",
    registry: n.crn ? `CRN ${n.crn}${n.uf ? `/${n.uf}` : ""}` : null,
    rqe: null,
    city: n.city || null,
    state: n.uf || null,
    clinic: null,
    photoUrl: n.photoUrl || null,
    bio: n.bio || null,
  };
}

export function alliedPublicCard(p: AlliedProfessional): ProfessionalPublicCard {
  const kind: ProfessionalKind = p.role;
  const meta = ROLE_META[p.role];
  return {
    id: p.id,
    kind,
    name: p.name,
    professionalName: p.name,
    profession: PROFESSION_LABELS[kind],
    specialty: p.specialty || meta.label,
    registry: p.registry ? `${meta.registry} ${p.registry}${p.uf ? `/${p.uf}` : ""}` : null,
    rqe: null,
    city: p.city || null,
    state: p.uf || null,
    clinic: null,
    photoUrl: p.photoUrl || null,
    bio: p.bio || null,
  };
}

export function actorFromCard(card: ProfessionalPublicCard): NetworkActor {
  return {
    kind: card.kind,
    id: card.id,
    name: card.name,
    professionalName: card.professionalName,
    profession: card.profession,
    specialty: card.specialty,
    photoUrl: card.photoUrl,
    notifyRole: "medico",
  };
}

export function displayHonorific(actor: Pick<NetworkActor, "name" | "kind">): string {
  return honorific(actor.name, actor.kind);
}

export async function getNetworkActor(): Promise<NetworkActor | null> {
  const doctorId = await getDoctorSessionId();
  if (doctorId) {
    const d = await getDoctorById(doctorId);
    if (d && (d.status ?? "approved") === "approved") {
      return actorFromCard(doctorPublicCard(d));
    }
  }
  const nutId = await getNutritionistId();
  if (nutId) {
    const n = await getNutritionist(nutId);
    if (n && n.status === "active") return actorFromCard(nutritionPublicCard(n));
  }
  const alliedId = await getAlliedSessionId();
  if (alliedId) {
    const p = await getAlliedProfessional(alliedId);
    if (p && p.status === "active") return actorFromCard(alliedPublicCard(p));
  }
  return null;
}

export async function getProfessionalCard(
  kind: ProfessionalKind,
  id: string
): Promise<ProfessionalPublicCard | null> {
  if (kind === "doctor") {
    const d = await getDoctorById(id);
    if (!d || (d.status ?? "approved") !== "approved") return null;
    return doctorPublicCard(d);
  }
  if (kind === "nutrition") {
    const n = await getNutritionist(id);
    if (!n || n.status !== "active") return null;
    return nutritionPublicCard(n);
  }
  const p = await getAlliedProfessional(id);
  if (!p || p.role !== kind || p.status !== "active") return null;
  return alliedPublicCard(p);
}
