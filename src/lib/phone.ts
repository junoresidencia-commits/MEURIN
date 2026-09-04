/** Dígitos de telefone brasileiro, com DDI 55 quando faltar. */
export function phoneDigits(phone?: string | null): string {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("55") ? d : `55${d}`;
}

/** Link wa.me para o número informado (null se não houver telefone). */
export function whatsappTo(phone?: string | null, text?: string): string | null {
  const d = phoneDigits(phone);
  if (!d) return null;
  return text ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : `https://wa.me/${d}`;
}
