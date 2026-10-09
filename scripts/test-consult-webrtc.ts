import assert from "node:assert/strict";
import {
  forcePatientFromSearch,
  isEmbeddedBrowser,
  patientInviteUrl,
  playbackSignals,
  presenceIsFresh,
  resolveConsultRole,
} from "../src/lib/consult-webrtc";
import {
  allowConsultEvent,
} from "../src/lib/consult-events-store";
import {
  explainMediaError,
  looksLikeSensitiveConsultPayload,
  overlayCopy,
  qualityFromStats,
  qualityIndicator,
  networkNotice,
  nextVideoTier,
  recentLossRatio,
  reconnectAction,
  resolveCallPhase,
  sanitizeConsultEvent,
  unwrapSignal,
  wrapSignal,
  serializeIce,
  serializeSdp,
  shouldQueueRemoteIce,
  keepPlaybackIce,
  mergeRemoteTrack,
  tryPlayMedia,
  NET_COPY,
  isGenericCallError,
  parsePeerNetHint,
  pastDisconnectGrace,
} from "../src/lib/consult-call";
import { appendSignalingMessage, listSignalingForRoom } from "../src/lib/store";
import { listRoomPresence, upsertRoomPresence } from "../src/lib/room-presence";

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Recuse: este teste não pode apontar para Supabase (produção).");
    process.exit(1);
  }

  assert.equal(forcePatientFromSearch("?como=paciente"), true);
  assert.equal(forcePatientFromSearch("teste=1"), false);
  assert.equal(resolveConsultRole("doctor", true), "patient");
  assert.equal(resolveConsultRole("doctor", false), "doctor");
  assert.equal(resolveConsultRole("guest", false), "patient");

  assert.equal(
    patientInviteUrl("https://meurim.app/consulta/abc-123?teste=1"),
    "https://meurim.app/consulta/abc-123?como=paciente"
  );
  assert.equal(patientInviteUrl("/consulta/abc-123"), "/consulta/abc-123?como=paciente");

  assert.equal(isEmbeddedBrowser("Mozilla/5.0 WhatsApp/2.24"), true);
  assert.equal(isEmbeddedBrowser("Mozilla/5.0 Instagram 300.0"), true);
  assert.equal(isEmbeddedBrowser("Mozilla/5.0 (Macintosh) Chrome/120.0"), false);

  const batch = playbackSignals([
    { from: "doctor", type: "join", payload: "{}", createdAt: "1" },
    { from: "doctor", type: "offer", payload: "old", createdAt: "2" },
    { from: "doctor", type: "ice", payload: "old-ice", createdAt: "3" },
    { from: "doctor", type: "offer", payload: "new", createdAt: "4" },
    { from: "doctor", type: "ice", payload: "new-ice", createdAt: "5" },
    { from: "patient", type: "answer", payload: "a", createdAt: "6" },
  ]);
  assert.deepEqual(
    batch.map((m) => m.payload),
    ["{}", "new", "new-ice", "a"]
  );

  const sessionIce = JSON.stringify({ __s: "s1", body: { candidate: "early", sdpMid: "0", sdpMLineIndex: 0 } });
  const sessionOffer = JSON.stringify({ __s: "s1", body: { type: "offer", sdp: "v=0" } });
  const raced = playbackSignals([
    { from: "doctor", type: "ice", payload: sessionIce, createdAt: "1" },
    { from: "doctor", type: "offer", payload: sessionOffer, createdAt: "2" },
  ]);
  assert.equal(raced.length, 2, "ICE da mesma sessão que chegou antes do offer não se perde");
  const otherSess = JSON.stringify({ __s: "old", body: { candidate: "stale", sdpMid: "0", sdpMLineIndex: 0 } });
  const dropped = playbackSignals([
    { from: "doctor", type: "ice", payload: otherSess, createdAt: "1" },
    { from: "doctor", type: "offer", payload: sessionOffer, createdAt: "2" },
  ]);
  assert.deepEqual(dropped.map((m) => m.type), ["offer"]);

  assert.equal(presenceIsFresh(new Date().toISOString(), Date.now(), 20_000), true);
  assert.equal(presenceIsFresh(new Date(Date.now() - 60_000).toISOString(), Date.now(), 20_000), false);

  const roomId = "room-presence-test";
  await upsertRoomPresence({ roomId, role: "patient", pageOpen: true, inCall: false });
  await upsertRoomPresence({ roomId, role: "patient", pageOpen: true, inCall: true });
  const peers = await listRoomPresence(roomId);
  const patient = peers.find((p) => p.role === "patient");
  assert.equal(patient?.inCall, true);
  assert.equal(patient?.pageOpen, true);

  const sigRoom = "room-sig-join";
  await appendSignalingMessage({
    id: "join-1",
    roomId: sigRoom,
    from: "patient",
    type: "join",
    payload: "{\"n\":1}",
    createdAt: new Date().toISOString(),
  });
  await appendSignalingMessage({
    id: "join-2",
    roomId: sigRoom,
    from: "patient",
    type: "join",
    payload: "{\"n\":2}",
    createdAt: new Date(Date.now() + 5).toISOString(),
  });
  const joins = (await listSignalingForRoom(sigRoom)).filter((m) => m.type === "join");
  assert.equal(joins.length, 1, "join do mesmo papel substitui o anterior");
  assert.equal(joins[0].payload, "{\"n\":2}");

  await appendSignalingMessage({
    id: "leave-1",
    roomId: sigRoom,
    from: "patient",
    type: "leave",
    payload: "{}",
    createdAt: new Date(Date.now() + 10).toISOString(),
  });
  const types = (await listSignalingForRoom(sigRoom)).map((m) => m.type);
  assert.ok(types.includes("leave"));

  const denied = explainMediaError({ name: "NotAllowedError" });
  assert.equal(denied.canRetry, true);
  assert.match(denied.body, /Ajustes|cadeado/);
  const overlay = overlayCopy("waiting_peer", "Médico", "Maria");
  assert.ok(overlay && overlay.title.includes("Maria"));
  assert.equal(overlayCopy("connected", "Médico", "Maria"), null);

  assert.equal(
    resolveCallPhase({
      joined: true,
      mediaError: false,
      connected: false,
      reconnecting: false,
      peerInCall: false,
      peerOnPage: true,
      peerLeft: false,
    }),
    "waiting_peer"
  );
  assert.equal(
    resolveCallPhase({
      joined: true,
      mediaError: false,
      connected: false,
      reconnecting: true,
      peerInCall: true,
      peerOnPage: true,
      peerLeft: false,
      ice: "disconnected",
    }),
    "reconnecting"
  );

  assert.equal(
    resolveCallPhase({
      joined: true,
      mediaError: false,
      connected: true,
      reconnecting: true,
      peerInCall: true,
      peerOnPage: true,
      peerLeft: false,
      ice: "disconnected",
    }),
    "reconnecting",
    "internet ruim não vira consulta encerrada"
  );

  const reconnectingUi = overlayCopy("reconnecting", "Médico", "Maria");
  assert.equal(reconnectingUi?.title, NET_COPY.reconnecting);
  assert.equal(isGenericCallError(reconnectingUi?.title || ""), false);
  assert.equal(isGenericCallError(NET_COPY.localUnstable), false);

  assert.equal(
    reconnectAction({ ice: "disconnected", failCount: 0, lastAttemptAt: 0, disconnectedSince: 4000, now: 5000 }),
    "none",
    "aguarda alguns segundos antes de religar"
  );
  assert.equal(
    reconnectAction({ ice: "disconnected", failCount: 0, lastAttemptAt: 0, disconnectedSince: 1000, now: 10000 }),
    "ice-restart"
  );
  assert.equal(reconnectAction({ ice: "failed", failCount: 0, lastAttemptAt: 0, now: 5000 }), "ice-restart");
  assert.equal(reconnectAction({ ice: "failed", failCount: 2, lastAttemptAt: 0, now: 5000 }), "rebuild");
  assert.equal(reconnectAction({ ice: "disconnected", failCount: 0, lastAttemptAt: 4000, now: 5000 }), "none");
  assert.equal(pastDisconnectGrace(1000, 4000, 8000), false);
  assert.equal(pastDisconnectGrace(1000, 10000, 8000), true);

  const wrapped = wrapSignal("abc", { type: "offer", sdp: "v=0" });
  const undone = unwrapSignal(JSON.stringify(wrapped));
  assert.equal(undone.session, "abc");
  assert.equal((undone.body as { type: string }).type, "offer");

  assert.equal(looksLikeSensitiveConsultPayload({ sdp: "v=0 raw" }), true);
  assert.equal(looksLikeSensitiveConsultPayload({ kind: "join", roomId: "x" }), false);
  assert.equal(
    sanitizeConsultEvent({
      roomId: "bb380928-a49d-4d4e-9b23-2f3105ad9935",
      role: "doctor",
      kind: "ice_failed",
      iceState: "failed",
      browser: "chrome",
    })?.kind,
    "ice_failed"
  );
  assert.equal(
    sanitizeConsultEvent({ roomId: "nope", role: "doctor", kind: "join" }),
    null
  );
  assert.equal(qualityFromStats({ rttMs: 80, lossRatio: 0 }), "good");
  assert.equal(qualityFromStats({ rttMs: 900, lossRatio: 0.2 }), "poor");
  assert.equal(qualityFromStats({ rttMs: 80, lossRatio: 0, jitterMs: 90 }), "poor");
  assert.equal(qualityFromStats({ rttMs: 80, lossRatio: 0, availableBitrate: 80_000 }), "poor");
  assert.equal(recentLossRatio({ lost: 10, received: 90, jitterMs: 0 }, { lost: 20, received: 180, jitterMs: 0 }), 0.1);
  assert.equal(nextVideoTier(1, "poor", 2, 0), 2);
  assert.equal(nextVideoTier(3, "poor", 2, 0), 4, "vídeo cai até só áudio");
  assert.equal(nextVideoTier(4, "good", 0, 3), 3, "vídeo volta quando a rede melhora");
  assert.equal(qualityIndicator("good")?.label, "Conexão boa");
  assert.equal(qualityIndicator("fair")?.emoji, "🟡");
  assert.equal(qualityIndicator("poor")?.emoji, "🔴");
  assert.equal(
    networkNotice({ reconnecting: true, quality: "poor", audioOnly: false, localRole: "doctor" })?.text,
    NET_COPY.reconnecting
  );
  assert.equal(
    networkNotice({ reconnecting: false, quality: "fair", audioOnly: false, localRole: "patient" })?.text,
    NET_COPY.localUnstable
  );
  assert.equal(
    networkNotice({ reconnecting: false, quality: "good", peerQuality: "poor", audioOnly: false, localRole: "doctor" })?.text,
    NET_COPY.patientUnstable
  );
  assert.equal(
    networkNotice({ reconnecting: false, quality: "good", peerQuality: "poor", audioOnly: false, localRole: "patient" })?.text,
    NET_COPY.professionalUnstable
  );
  assert.equal(
    networkNotice({ reconnecting: false, quality: "good", audioOnly: true, localRole: "doctor" })?.text,
    NET_COPY.audioPriority
  );
  assert.equal(parsePeerNetHint({ quality: "fair" }), "fair");
  assert.equal(parsePeerNetHint({ quality: "nope" }), null);

  assert.deepEqual(serializeSdp({ type: "offer", sdp: "v=0\r\no=- 1 1 IN IP4 0.0.0.0" }), {
    type: "offer",
    sdp: "v=0\r\no=- 1 1 IN IP4 0.0.0.0",
  });
  assert.equal(serializeSdp({ type: "offer" }), null);
  assert.deepEqual(serializeIce({ candidate: "candidate:1 udp 1", sdpMid: "0", sdpMLineIndex: 0 }), {
    candidate: "candidate:1 udp 1",
    sdpMid: "0",
    sdpMLineIndex: 0,
    usernameFragment: undefined,
  });
  assert.equal(serializeIce({ candidate: "" }), null);
  assert.equal(shouldQueueRemoteIce(false), true);
  assert.equal(shouldQueueRemoteIce(true), false);
  assert.equal(
    keepPlaybackIce({ iceIndex: 0, lastOfferIndex: 1, iceSession: "s1", offerSession: "s1" }),
    true
  );
  assert.equal(
    keepPlaybackIce({ iceIndex: 0, lastOfferIndex: 1, iceSession: "old", offerSession: "s1" }),
    false
  );

  const fakeStream = {
    tracks: [] as { id: string; kind: string }[],
    getTracks() {
      return this.tracks;
    },
    addTrack(track: { id: string; kind: string }) {
      this.tracks.push(track);
    },
    removeTrack(track: { id: string; kind: string }) {
      this.tracks = this.tracks.filter((t) => t.id !== track.id);
    },
  };
  mergeRemoteTrack(fakeStream, { id: "a1", kind: "audio" });
  mergeRemoteTrack(fakeStream, { id: "v1", kind: "video" });
  mergeRemoteTrack(fakeStream, { id: "v2", kind: "video" });
  assert.deepEqual(
    fakeStream.tracks.map((t) => t.id),
    ["a1", "v2"],
    "áudio e vídeo no mesmo stream; vídeo novo substitui o anterior"
  );

  let plays = 0;
  const blockedEl = {
    muted: false,
    async play() {
      plays += 1;
      if (!this.muted) throw new Error("NotAllowedError");
    },
  };
  assert.equal(await tryPlayMedia(blockedEl, true), "blocked");
  assert.equal(blockedEl.muted, true);
  assert.ok(plays >= 2, "tenta com áudio e depois mudo");
  const okEl = { muted: true, async play() {} };
  assert.equal(await tryPlayMedia(okEl, true), "playing");
  assert.equal(okEl.muted, false);

  const roomEv = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  assert.equal(allowConsultEvent(roomEv, 1_000, 60_000, 2), true);
  assert.equal(allowConsultEvent(roomEv, 1_001, 60_000, 2), true);
  assert.equal(allowConsultEvent(roomEv, 1_002, 60_000, 2), false);

  console.log("consult-webrtc ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
