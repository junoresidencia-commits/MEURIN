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

function signalSession(payload: string): string | null {
  try {
    const parsed = JSON.parse(payload) as { __s?: unknown };
    return parsed && typeof parsed.__s === "string" ? parsed.__s : null;
  } catch {
    return null;
  }
}

/**
 * Num lote de sinalização, usa só o último offer.
 * ICE depois dele entra; ICE um instante antes também, se for da mesma sessão
 * (trickle disparou durante setLocalDescription, antes do POST do SDP).
 */
export function playbackSignals<T extends SignalMsg>(messages: T[]): T[] {
  let lastOffer = -1;
  for (let i = 0; i < messages.length; i += 1) {
    if (messages[i].type === "offer") lastOffer = i;
  }
  const offerSession = lastOffer >= 0 ? signalSession(messages[lastOffer].payload) : null;
  return messages.filter((m, i) => {
    if (m.type === "offer") return i === lastOffer;
    if (m.type === "ice") {
      if (lastOffer < 0 || i > lastOffer) return true;
      return Boolean(offerSession && signalSession(m.payload) === offerSession);
    }
    return true;
  });
}

export function presenceIsFresh(lastSeenIso?: string | null, now = Date.now(), maxMs = 20_000): boolean {
  if (!lastSeenIso) return false;
  const t = Date.parse(lastSeenIso);
  return Number.isFinite(t) && now - t < maxMs;
}
