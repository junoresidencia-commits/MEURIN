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
  reconnectAction,
  resolveCallPhase,
  sanitizeConsultEvent,
  unwrapSignal,
  wrapSignal,
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

  assert.equal(reconnectAction({ ice: "disconnected", failCount: 0, lastAttemptAt: 0, now: 5000 }), "ice-restart");
  assert.equal(reconnectAction({ ice: "failed", failCount: 2, lastAttemptAt: 0, now: 5000 }), "rebuild");
  assert.equal(reconnectAction({ ice: "disconnected", failCount: 0, lastAttemptAt: 4000, now: 5000 }), "none");

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
