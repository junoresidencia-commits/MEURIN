/**
 * Servidores ICE da consulta online.
 * Sempre inclui STUN. TURN entra quando houver credencial no ambiente
 * (Metered, Twilio ou TURN_URLS) — necessário em NAT difícil / rede do interior.
 */

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const STUN: IceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

type Cache = { at: number; servers: IceServer[]; turn: boolean };
let cache: Cache | null = null;
const TTL_MS = 60_000;

function envTurn(): IceServer[] {
  const urls = String(process.env.TURN_URLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const username = String(process.env.TURN_USERNAME || "").trim();
  const credential = String(process.env.TURN_CREDENTIAL || "").trim();
  if (!urls.length || !username || !credential) return [];
  return [{ urls, username, credential }];
}

async function meteredTurn(): Promise<IceServer[]> {
  const key = String(process.env.METERED_TURN_API_KEY || "").trim();
  if (!key) return [];
  const raw = String(process.env.METERED_TURN_DOMAIN || "").trim();
  if (!raw) return [];
  const host = raw.includes(".") ? raw : `${raw}.metered.live`;
  const res = await fetch(`https://${host}/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`metered ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? (data as IceServer[]) : [];
}

async function twilioTurn(): Promise<IceServer[]> {
  const sid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
  const token = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  if (!sid || !token) return [];
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Tokens.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`twilio ${res.status}`);
  const data = (await res.json()) as { ice_servers?: IceServer[] };
  return Array.isArray(data.ice_servers) ? data.ice_servers : [];
}

function hasTurn(servers: IceServer[]): boolean {
  return servers.some((s) => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    return urls.some((u) => String(u).startsWith("turn:") || String(u).startsWith("turns:"));
  });
}

export async function getIceServers(): Promise<{ iceServers: IceServer[]; turn: boolean }> {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return { iceServers: cache.servers, turn: cache.turn };
  }

  const extra: IceServer[] = [...envTurn()];
  try {
    extra.push(...(await meteredTurn()));
  } catch (err) {
    console.error("[ice] Metered TURN", err);
  }
  try {
    extra.push(...(await twilioTurn()));
  } catch (err) {
    console.error("[ice] Twilio TURN", err);
  }

  const iceServers = [...STUN, ...extra];
  const turn = hasTurn(iceServers);
  cache = { at: Date.now(), servers: iceServers, turn };
  return { iceServers, turn };
}
