import type { PixKeyType, PixProfile } from "./types";

export const PIX_KEY_TYPES: PixKeyType[] = ["cpf", "cnpj", "email", "telefone", "aleatoria"];

export const PIX_KEY_TYPE_LABELS: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  aleatoria: "Chave aleatória",
};

export const PIX_ERRORS = {
  invalid: "A chave PIX informada é inválida.",
  duplicate: "Esta chave PIX já está cadastrada.",
  saveFailed: "Não foi possível salvar sua chave PIX. Verifique os dados informados.",
  saved: "Chave PIX salva com sucesso.",
  deleted: "Chave PIX removida.",
  missingType: "Selecione o tipo de chave PIX.",
  missingKey: "Informe a chave PIX.",
} as const;

export function onlyDigits(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function isValidCpfDigits(digits: string): boolean {
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(digits[10]);
}

function isValidCnpjDigits(digits: string): boolean {
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const calc = (w: number[]) => {
    const sum = w.reduce((acc, weight, i) => acc + Number(digits[i]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(w1) === Number(digits[12]) && calc(w2) === Number(digits[13]);
}

/** Telefone PIX: +55 + DDD + número. Aceita (77) 99999-9999, 77999999999 e +55 77 99999-9999. */
export function normalizePixPhone(raw: string): string | null {
  let digits = onlyDigits(raw);
  if (!digits) return null;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.length === 12 || digits.length === 13) return `+${digits}`;
  return null;
}

export function normalizePixKey(
  type: PixKeyType,
  raw: string
): { ok: true; key: string } | { ok: false; error: string } {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { ok: false, error: PIX_ERRORS.missingKey };

  if (type === "cpf") {
    const digits = onlyDigits(trimmed);
    if (digits.length !== 11 || !isValidCpfDigits(digits)) {
      return { ok: false, error: PIX_ERRORS.invalid };
    }
    return { ok: true, key: digits };
  }

  if (type === "cnpj") {
    const digits = onlyDigits(trimmed);
    if (digits.length !== 14 || !isValidCnpjDigits(digits)) {
      return { ok: false, error: PIX_ERRORS.invalid };
    }
    return { ok: true, key: digits };
  }

  if (type === "telefone") {
    const phone = normalizePixPhone(trimmed);
    if (!phone) return { ok: false, error: PIX_ERRORS.invalid };
    return { ok: true, key: phone };
  }

  if (type === "email") {
    const email = trimmed.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: PIX_ERRORS.invalid };
    }
    return { ok: true, key: email };
  }

  const uuid = trimmed.replace(/[{}]/g, "").toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) {
    return { ok: false, error: PIX_ERRORS.invalid };
  }
  return { ok: true, key: uuid };
}

export function isPixKeyType(value: unknown): value is PixKeyType {
  return PIX_KEY_TYPES.includes(value as PixKeyType);
}

export function parsePixProfileInput(
  raw: Record<string, unknown> | null | undefined
): { ok: true; profile: PixProfile } | { ok: false; error: string } {
  const p = raw || {};
  if (!isPixKeyType(p.keyType)) {
    return { ok: false, error: PIX_ERRORS.missingType };
  }
  const normalized = normalizePixKey(p.keyType, String(p.key || ""));
  if (!normalized.ok) return normalized;
  return {
    ok: true,
    profile: {
      keyType: p.keyType,
      key: normalized.key,
      holderName: p.holderName ? String(p.holderName).trim() : undefined,
      holderDoc: p.holderDoc ? String(p.holderDoc).trim() : undefined,
      bank: p.bank ? String(p.bank).trim() : undefined,
      city: p.city ? String(p.city).trim() : undefined,
    },
  };
}

export function samePixKey(a?: string | null, b?: string | null): boolean {
  const left = String(a || "").trim().toLowerCase();
  const right = String(b || "").trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;
  const da = onlyDigits(left);
  const db = onlyDigits(right);
  if (da.length >= 10 && da === db) return true;
  if (da.length >= 10 && db.length >= 10) {
    const tail = (s: string) => (s.startsWith("55") && s.length >= 12 ? s.slice(-11) : s.slice(-11));
    if (tail(da) === tail(db)) return true;
  }
  return false;
}
