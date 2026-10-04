export type CallPhase =
  | "lobby"
  | "media"
  | "waiting_peer"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "peer_left"
  | "failed"
  | "denied";

export type ConsultEventKind =
  | "join"
  | "leave"
  | "connected"
  | "reconnect"
  | "ice_failed"
  | "media_denied"
  | "offline"
  | "embedded"
  | "peer_left";

export type MediaHelp = {
  title: string;
  body: string;
  canRetry: boolean;
  allowAudioOnly: boolean;
};

const EVENT_KINDS = new Set<ConsultEventKind>([
  "join",
  "leave",
  "connected",
  "reconnect",
  "ice_failed",
  "media_denied",
  "offline",
  "embedded",
  "peer_left",
]);

export function explainMediaError(err: unknown): MediaHelp {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      title: "Permita câmera e microfone",
      body: "Toque em Permitir quando o navegador perguntar. No iPhone: Ajustes → Safari (ou Chrome) → Câmera e Microfone. No Android: toque no cadeado do endereço → Permissões. No computador: o ícone de cadeado na barra de endereço.",
      canRetry: true,
      allowAudioOnly: true,
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      title: "Nenhuma câmera ou microfone",
      body: "Conecte um dispositivo ou permita o acesso. Você ainda pode tentar entrar só com áudio.",
      canRetry: true,
      allowAudioOnly: true,
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      title: "Câmera ocupada",
      body: "Outro aplicativo está usando a câmera. Feche Zoom, Meet ou a câmera do sistema e tente de novo.",
      canRetry: true,
      allowAudioOnly: true,
    };
  }
  if (name === "SecurityError" || name === "NotSupportedError") {
    return {
      title: "Abra no navegador do celular",
      body: "O vídeo não funciona no navegador interno do WhatsApp ou Instagram. Toque em Abrir no Chrome ou Safari e entre de novo.",
      canRetry: true,
      allowAudioOnly: false,
    };
  }
  return {
    title: "Não foi possível ligar câmera ou microfone",
    body: "Permita o acesso no navegador (HTTPS) e tente de novo. Se recusar a câmera, entre só com o microfone.",
    canRetry: true,
    allowAudioOnly: true,
  };
}

export function resolveCallPhase(input: {
  joined: boolean;
  mediaError: boolean;
  connected: boolean;
  reconnecting: boolean;
  peerInCall: boolean;
  peerOnPage: boolean;
  peerLeft: boolean;
  ice?: string;
}): CallPhase {
  if (input.mediaError) return "denied";
  if (!input.joined) return "lobby";
  if (input.connected) return "connected";
  if (input.reconnecting || input.ice === "disconnected" || input.ice === "failed") return "reconnecting";
  if (input.peerLeft) return "peer_left";
  if (input.ice === "checking" || input.ice === "connected") return "connecting";
  if (input.peerInCall) return "connecting";
  if (input.peerOnPage) return "waiting_peer";
  return "waiting_peer";
}

export function overlayCopy(phase: CallPhase, hostLabel: string, otherName: string): { title: string; detail: string } | null {
  switch (phase) {
    case "lobby":
      return { title: "Fora da chamada", detail: "Toque em Entrar para ligar câmera e microfone." };
    case "media":
      return { title: "Pedindo câmera…", detail: "Aceite a permissão do navegador." };
    case "waiting_peer":
      return { title: `Aguardando ${otherName}`, detail: `${otherName} precisa abrir o link e tocar em Entrar na consulta.` };
    case "connecting":
      return { title: "Conectando o vídeo…", detail: `${otherName} já entrou. Cruzando áudio e imagem.` };
    case "reconnecting":
      return { title: "Religando…", detail: "A internet oscilou. Tentamos de novo automaticamente. O prontuário continua aberto." };
    case "peer_left":
      return { title: `${otherName} saiu`, detail: "A sala continua aberta. Quando a pessoa voltar, o vídeo religa." };
    case "failed":
      return { title: "Não deu para cruzar o vídeo", detail: "Peça para os dois tocarem em Entrar de novo, de preferência no Chrome ou Safari." };
    case "denied":
      return { title: "Sem câmera ou microfone", detail: "Libere a permissão e tente de novo." };
    case "connected":
      return null;
    default:
      return { title: hostLabel, detail: "" };
  }
}

export function reconnectAction(input: {
  ice?: string;
  failCount: number;
  lastAttemptAt: number;
  now?: number;
}): "none" | "ice-restart" | "rebuild" {
  const now = input.now ?? Date.now();
  if (now - input.lastAttemptAt < 2500) return "none";
  if (input.ice === "failed" || input.failCount >= 2) return "rebuild";
  if (input.ice === "disconnected") return "ice-restart";
  return "none";
}

export function pollIntervalMs(phase: CallPhase): number {
  if (phase === "connecting" || phase === "reconnecting" || phase === "waiting_peer") return 800;
  if (phase === "connected") return 2500;
  return 1500;
}

export function wrapSignal(session: string, body: unknown): { __s: string; body: unknown } {
  return { __s: session, body };
}

export function unwrapSignal(raw: string): { session: string | null; body: unknown } {
  try {
    const parsed = JSON.parse(raw) as { __s?: unknown; body?: unknown };
    if (parsed && typeof parsed === "object" && typeof parsed.__s === "string" && "body" in parsed) {
      return { session: parsed.__s, body: parsed.body };
    }
    return { session: null, body: parsed };
  } catch {
    return { session: null, body: null };
  }
}

export function looksLikeSensitiveConsultPayload(value: unknown): boolean {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  if (text.length > 400) return true;
  return /v=0|m=audio|a=candidate|sdp|patientName|history|prontu[aá]rio|evolu[cç][aã]o/i.test(text);
}

export function sanitizeConsultEvent(input: {
  roomId?: unknown;
  role?: unknown;
  kind?: unknown;
  iceState?: unknown;
  browser?: unknown;
  turn?: unknown;
  phase?: unknown;
}):
  | {
      roomId: string;
      role: "doctor" | "patient";
      kind: ConsultEventKind;
      iceState?: string;
      browser?: string;
      turn?: boolean;
      phase?: string;
    }
  | null {
  const roomId = String(input.roomId || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(roomId)) {
    return null;
  }
  const role = input.role === "doctor" || input.role === "patient" ? input.role : null;
  const kind = typeof input.kind === "string" && EVENT_KINDS.has(input.kind as ConsultEventKind)
    ? (input.kind as ConsultEventKind)
    : null;
  if (!role || !kind) return null;
  const iceState = typeof input.iceState === "string" ? input.iceState.slice(0, 24) : undefined;
  const browser = typeof input.browser === "string" ? input.browser.slice(0, 24) : undefined;
  const phase = typeof input.phase === "string" ? input.phase.slice(0, 24) : undefined;
  return {
    roomId,
    role,
    kind,
    iceState,
    browser,
    phase,
    turn: typeof input.turn === "boolean" ? input.turn : undefined,
  };
}

export function browserFamily(ua: string): string {
  if (/Edg\//.test(ua)) return "edge";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "chrome";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "safari";
  if (/WhatsApp|Instagram|FBAN|FBAV/.test(ua)) return "embedded";
  return "other";
}

export function qualityFromStats(input: { rttMs?: number; lossRatio?: number }): "good" | "fair" | "poor" {
  const rtt = input.rttMs ?? 0;
  const loss = input.lossRatio ?? 0;
  if (loss > 0.08 || rtt > 600) return "poor";
  if (loss > 0.03 || rtt > 250) return "fair";
  return "good";
}

export function mediaConstraints(video: boolean): MediaStreamConstraints {
  return {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: video
      ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
      : false,
  };
}
