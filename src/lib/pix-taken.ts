import "server-only";
import { listDoctors } from "./store";
import { listAllNutritionists } from "./nutritionists-store";
import { listAlliedProfessionals } from "./allied-store";
import { samePixKey } from "./pix-key";

export async function pixKeyAlreadyTaken(
  key: string,
  except?: { kind: "doctor" | "nutrition" | "allied"; id: string }
): Promise<boolean> {
  const doctors = await listDoctors();
  for (const d of doctors) {
    if (except?.kind === "doctor" && except.id === d.id) continue;
    if (samePixKey(d.pixProfile?.key, key) || samePixKey(d.pixKey, key)) return true;
  }
  try {
    const nuts = await listAllNutritionists();
    for (const n of nuts) {
      if (except?.kind === "nutrition" && except.id === n.id) continue;
      if (samePixKey(n.pixProfile?.key, key)) return true;
    }
  } catch (err) {
    console.error("[pix] checagem nutricionistas", err);
  }
  try {
    const allied = await listAlliedProfessionals();
    for (const p of allied) {
      if (except?.kind === "allied" && except.id === p.id) continue;
      if (samePixKey(p.pixProfile?.key, key)) return true;
    }
  } catch (err) {
    console.error("[pix] checagem equipe assistencial", err);
  }
  return false;
}
