export type ConsultRole = "doctor" | "patient";
export type SignalType = "offer" | "answer" | "ice" | "join" | "leave" | "here";

export type SignalMsg = {
  from: string;
  type: string;
  payload: string;
  createdAt: string;
};

/** Link copiado pelo médico: quem abre entra como paciente, mesmo com cookie de médico. */
export function patientInviteUrl(href: string): string {
  const absolute = /^https?:\/\//i.test(href);
  const url = absolute ? new URL(href) : new URL(href, "http://local.invalid");
  url.searchParams.set("como", "paciente");
  url.searchParams.delete("teste");
  if (!absolute) return `${url.pathname}${url.search}${url.hash}`;
  return url.toString();
}

export function forcePatientFromSearch(search: string): boolean {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(raw).get("como") === "paciente";
}

export function resolveConsultRole(
  apiRole: string | undefined,
  forcePatient: boolean
): ConsultRole {
  if (forcePatient) return "patient";
  return apiRole === "doctor" ? "doctor" : "patient";
}

/** WhatsApp / Instagram / Facebook / WebView — WebRTC costuma falhar aí. */
export function isEmbeddedBrowser(ua: string): boolean {
  return /WhatsApp|FBAN|FBAV|Instagram|Line\/|; wv\)|WebView|GSA\//i.test(ua);
}

/**
 * Num lote de sinalização, usa só o último offer e os ICE depois dele.
 * Evita responder a um convite velho quando o médico reentrou.
 */
export function playbackSignals<T extends SignalMsg>(messages: T[]): T[] {
  let lastOffer = -1;
  for (let i = 0; i < messages.length; i += 1) {
    if (messages[i].type === "offer") lastOffer = i;
  }
  return messages.filter((m, i) => {
    if (m.type === "offer") return i === lastOffer;
    if (m.type === "ice") return lastOffer < 0 || i > lastOffer;
    return true;
  });
}

export function presenceIsFresh(lastSeenIso?: string | null, now = Date.now(), maxMs = 20_000): boolean {
  if (!lastSeenIso) return false;
  const t = Date.parse(lastSeenIso);
  return Number.isFinite(t) && now - t < maxMs;
}
