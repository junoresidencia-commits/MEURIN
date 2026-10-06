"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatSlotLabel } from "@/lib/scheduling-client";
import { ConsultChartPanel } from "@/components/ConsultChartPanel";
import { CareConsultPanel } from "@/components/CareConsultPanel";
import { ConsultVideoStage } from "@/components/ConsultVideoStage";
import { PixCheckout } from "@/components/PixCheckout";
import {
  DEFAULT_VIDEO_TIER,
  NET_COPY,
  VIDEO_LADDER,
  browserFamily,
  explainMediaError,
  mediaConstraints,
  networkNotice,
  nextVideoTier,
  parsePeerNetHint,
  pollIntervalMs,
  qualityFromStats,
  recentLossRatio,
  reconnectAction,
  resolveCallPhase,
  unwrapSignal,
  wrapSignal,
  type CallPhase,
  type ConsultEventKind,
  type MediaHelp,
  type NetQuality,
  type RtpCounters,
} from "@/lib/consult-call";
import {
  forcePatientFromSearch,
  isEmbeddedBrowser,
  patientInviteUrl,
  playbackSignals,
  presenceIsFresh,
  resolveConsultRole,
} from "@/lib/consult-webrtc";

type Role = "doctor" | "patient";
type RoomRole = "doctor" | "patient" | "guest";
type RoomKind = "doctor" | "psychology" | "nursing" | "nutrition";
type IceServer = { urls: string | string[]; username?: string; credential?: string };
type SignalMsg = { from: Role; type: string; payload: string; createdAt: string };

const CARE_REASON: Record<string, string> = {
  pressa: "Com pressa",
  acompanhamento: "Acompanhamento",
  segunda_opiniao: "2ª opinião",
  outro: "Outro",
};

function newSession() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ConsultaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = params.id;
  const [showTestHint, setShowTestHint] = useState(false);
  const [embeddedBrowser, setEmbeddedBrowser] = useState(false);
  const [forcePatient, setForcePatient] = useState(false);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const roleRef = useRef<Role>("patient");
  const lastPoll = useRef("");
  const hungUp = useRef(false);
  const joinedRef = useRef(false);
  const iceRef = useRef<IceServer[] | null>(null);
  const sessionRef = useRef("");
  const offerSentRef = useRef(false);
  const answeredRef = useRef(false);
  const connectedRef = useRef(false);
  const pollingRef = useRef(false);
  const makingOfferRef = useRef(false);
  const iceStateRef = useRef("");
  const failCountRef = useRef(0);
  const lastReconnectRef = useRef(0);
  const disconnectedSinceRef = useRef(0);
  const videoTierRef = useRef(DEFAULT_VIDEO_TIER);
  const poorTicksRef = useRef(0);
  const goodTicksRef = useRef(0);
  const prevRtpRef = useRef<RtpCounters | null>(null);
  const userCamOffRef = useRef(false);
  const [role, setRole] = useState<Role>("patient");
  const [roomRole, setRoomRole] = useState<RoomRole>("guest");
  const [info, setInfo] = useState<{
    patientName: string;
    patientEmail?: string;
    patientKey?: string;
    doctorName: string;
    slotStart: string;
    careReason?: string;
  } | null>(null);
  const [roomKind, setRoomKind] = useState<RoomKind>("doctor");
  const [hostLabel, setHostLabel] = useState("Médico");
  const [homePath, setHomePath] = useState("/medicos/agenda");
  const [loginPath, setLoginPath] = useState("/medicos/login");
  const [status, setStatus] = useState("Preparando sala…");
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [copied, setCopied] = useState(false);
  const [turnReady, setTurnReady] = useState(false);
  const [peerOnPage, setPeerOnPage] = useState(false);
  const [peerInCall, setPeerInCall] = useState(false);
  const [peerLeft, setPeerLeft] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [hasRemote, setHasRemote] = useState(false);
  const [quality, setQuality] = useState<NetQuality | null>(null);
  const [peerQuality, setPeerQuality] = useState<NetQuality | null>(null);
  const [netAudioOnly, setNetAudioOnly] = useState(false);
  const [mediaHelp, setMediaHelp] = useState<MediaHelp | null>(null);
  const [iceState, setIceState] = useState("");
  const [paywall, setPaywall] = useState<{
    brCode: string;
    qrDataUrl: string;
    amountCents: number;
    holderName: string;
    isReturn?: boolean;
  } | null>(null);
  const [hostPay, setHostPay] = useState<{
    status: "unpaid" | "declared" | "confirmed" | "free";
    priceCents: number;
    holderName: string;
  } | null>(null);
  const [awaitingHost, setAwaitingHost] = useState(false);
  const [confirmingPix, setConfirmingPix] = useState(false);
  const [confirmErr, setConfirmErr] = useState("");

  const phase: CallPhase = useMemo(
    () =>
      resolveCallPhase({
        joined,
        mediaError: Boolean(mediaHelp) && !joined,
        connected: hasRemote || (joined && connectedRef.current && (iceState === "connected" || iceState === "completed")),
        reconnecting,
        peerInCall,
        peerOnPage,
        peerLeft,
        ice: iceState,
      }),
    [hasRemote, iceState, joined, mediaHelp, peerInCall, peerLeft, peerOnPage, reconnecting]
  );

  const notice = useMemo(
    () =>
      joined
        ? networkNotice({
            reconnecting,
            quality,
            peerQuality,
            audioOnly: netAudioOnly,
            localRole: role,
          })
        : null,
    [joined, netAudioOnly, peerQuality, quality, reconnecting, role]
  );

  useEffect(() => {
    const q = window.location.search;
    setShowTestHint(new URLSearchParams(q).get("teste") === "1");
    setForcePatient(forcePatientFromSearch(q));
    const embedded = isEmbeddedBrowser(navigator.userAgent);
    setEmbeddedBrowser(embedded);
    if (embedded) {
      void fetch("/api/consult-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          role: "patient",
          kind: "embedded",
          browser: "embedded",
        }),
      });
    }
  }, [roomId]);

  useEffect(() => {
    const q = forcePatientFromSearch(window.location.search) ? "?como=paciente" : "";
    fetch(`/api/rooms/${roomId}${q}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          if (data.paymentRequired) {
            setHostLabel(data.hostLabel || "Profissional");
            setHomePath("/paciente/inicio");
            setLoginPath(data.loginPath || "/paciente/entrar");
            if (data.pix?.brCode) {
              setPaywall({
                brCode: data.pix.brCode,
                qrDataUrl: data.pix.qrDataUrl || "",
                amountCents: data.pix.amountCents,
                holderName: data.pix.holderName || data.professionalName || "Profissional",
                isReturn: data.isReturn === true,
              });
              return;
            }
          }
          if (data.awaitingHost) {
            setHostLabel(data.hostLabel || "Profissional");
            setAwaitingHost(true);
            return;
          }
          throw new Error(data.error || "Sala indisponível");
        }
        const asPatient = forcePatientFromSearch(window.location.search);
        const nextRole = resolveConsultRole(data.you?.role, asPatient);
        setRoomRole(asPatient ? "patient" : data.you?.role || "guest");
        setRole(nextRole);
        roleRef.current = nextRole;
        setRoomKind((data.kind as RoomKind) || "doctor");
        setHostLabel(data.hostLabel || "Médico");
        setHomePath(data.homePath || "/medicos/agenda");
        setLoginPath(data.loginPath || "/medicos/login");
        setInfo({
          patientName: data.booking.patientName,
          patientEmail: data.booking.patientEmail,
          patientKey: data.booking.patientKey,
          doctorName: data.doctor?.name || data.hostLabel || "Profissional",
          slotStart: data.booking.slotStart,
          careReason: data.booking.careReason,
        });
        if (nextRole === "doctor" && data.payment?.priceCents > 0) {
          setHostPay({
            status: data.payment.status || "unpaid",
            priceCents: data.payment.priceCents,
            holderName: data.payment.holderName || data.doctor?.name || "você",
          });
        }
        setStatus(
          nextRole === "doctor"
            ? "Sala liberada. Entre para atender. O prontuário fica aberto ao lado do vídeo."
            : "Sala liberada. Toque em Entrar na consulta para o profissional te ver."
        );
      })
      .catch((e) => setError(e.message));
  }, [roomId]);

  const report = useCallback(
    (kind: ConsultEventKind, extra?: { iceState?: string; phase?: string }) => {
      void fetch("/api/consult-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          role: roleRef.current,
          kind,
          iceState: extra?.iceState,
          phase: extra?.phase,
          turn: turnReady,
          browser: browserFamily(navigator.userAgent),
        }),
      }).catch(() => undefined);
    },
    [roomId, turnReady]
  );

  const postSignal = useCallback(
    async (type: string, payload: unknown) => {
      await fetch("/api/signaling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          from: roleRef.current,
          type,
          payload: JSON.stringify(payload),
        }),
      });
    },
    [roomId]
  );

  const postPresence = useCallback(
    async (inCall: boolean) => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: roleRef.current, pageOpen: true, inCall }),
        });
        const data = await res.json().catch(() => ({}));
        const other = roleRef.current === "doctor" ? data.patient : data.doctor;
        if (other) {
          const fresh = presenceIsFresh(other.lastSeen);
          setPeerOnPage(fresh && other.pageOpen !== false);
          setPeerInCall(fresh && other.inCall === true);
          if (fresh && other.inCall) setPeerLeft(false);
        }
      } catch {
        /* presença é auxiliar */
      }
    },
    [roomId]
  );

  const attachRemote = useCallback((stream: MediaStream) => {
    const el = remoteVideo.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
    connectedRef.current = true;
    disconnectedSinceRef.current = 0;
    setHasRemote(true);
    setReconnecting(false);
    setPeerLeft(false);
    setStatus("Conectado. Consulta em andamento.");
  }, []);

  const loadIce = useCallback(async () => {
    if (iceRef.current) return iceRef.current;
    try {
      const res = await fetch("/api/webrtc/ice");
      const data = await res.json();
      const servers = Array.isArray(data.iceServers) && data.iceServers.length
        ? data.iceServers
        : [{ urls: "stun:stun.l.google.com:19302" }];
      iceRef.current = servers;
      setTurnReady(Boolean(data.turn));
      return servers;
    } catch {
      const fallback = [{ urls: "stun:stun.l.google.com:19302" }];
      iceRef.current = fallback;
      return fallback;
    }
  }, []);

  const applyMediaTier = useCallback(async (tier: number) => {
    const spec = VIDEO_LADDER[Math.min(4, Math.max(0, tier))];
    videoTierRef.current = spec.id;
    const audioOnly = spec.height === 0;
    setNetAudioOnly(audioOnly);
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      if (audioOnly) {
        videoTrack.enabled = false;
      } else {
        videoTrack.enabled = !userCamOffRef.current;
        await videoTrack.applyConstraints({
          width: { ideal: Math.round((spec.height * 16) / 9), max: 1280 },
          height: { ideal: spec.height, max: 720 },
          frameRate: { ideal: spec.height >= 480 ? 24 : 15, max: 24 },
        }).catch(() => undefined);
      }
    }
    const pc = pcRef.current;
    if (!pc) return;
    const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (videoSender?.getParameters) {
      const params = videoSender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.degradationPreference = "maintain-framerate";
      params.encodings[0].maxBitrate = spec.maxBitrate || 64_000;
      params.encodings[0].active = !audioOnly && !userCamOffRef.current;
      await videoSender.setParameters(params).catch(() => undefined);
    }
    const audioSender = pc.getSenders().find((s) => s.track?.kind === "audio");
    if (audioSender?.getParameters) {
      const params = audioSender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = 48_000;
      (params.encodings[0] as RTCRtpEncodingParameters & { priority?: string }).priority = "high";
      await audioSender.setParameters(params).catch(() => undefined);
    }
    if (audioOnly) setStatus(NET_COPY.audioPriority);
  }, []);

  const sendOffer = useCallback(async (restart = false) => {
    if (roleRef.current !== "doctor" || makingOfferRef.current) return;
    const pc = pcRef.current;
    if (!pc) return;
    makingOfferRef.current = true;
    try {
      const offer = await pc.createOffer(restart || answeredRef.current ? { iceRestart: true } : undefined);
      await pc.setLocalDescription(offer);
      await postSignal("offer", wrapSignal(sessionRef.current, offer));
      offerSentRef.current = true;
      setStatus(peerInCall ? "Paciente na sala. Cruzando o vídeo…" : "Aguardando o paciente entrar…");
    } catch {
      /* próximo ciclo tenta de novo */
    } finally {
      makingOfferRef.current = false;
    }
  }, [peerInCall, postSignal]);

  const bindPc = useCallback(
    (pc: RTCPeerConnection) => {
      pc.onicecandidate = (ev) => {
        if (ev.candidate) void postSignal("ice", wrapSignal(sessionRef.current, ev.candidate));
      };
      pc.ontrack = (ev) => {
        const stream = ev.streams[0] || new MediaStream([ev.track]);
        attachRemote(stream);
        report("connected", { iceState: pc.iceConnectionState });
      };
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        iceStateRef.current = state;
        setIceState(state);
        if (state === "connected" || state === "completed") {
          connectedRef.current = true;
          disconnectedSinceRef.current = 0;
          setReconnecting(false);
          failCountRef.current = 0;
          setStatus("Conectado. Consulta em andamento.");
        } else if (state === "checking") {
          if (!connectedRef.current) setStatus("Cruzando o vídeo…");
        } else if (state === "disconnected") {
          if (!disconnectedSinceRef.current) disconnectedSinceRef.current = Date.now();
          setReconnecting(true);
          setStatus(NET_COPY.reconnecting);
        } else if (state === "failed") {
          if (!disconnectedSinceRef.current) disconnectedSinceRef.current = Date.now();
          setReconnecting(true);
          failCountRef.current += 1;
          setStatus(NET_COPY.reconnecting);
          report("ice_failed", { iceState: state });
        }
      };
      pc.onconnectionstatechange = () => {
        const cs = pc.connectionState;
        if (cs === "connected") {
          connectedRef.current = true;
          disconnectedSinceRef.current = 0;
          setReconnecting(false);
        } else if (cs === "disconnected") {
          if (!disconnectedSinceRef.current) disconnectedSinceRef.current = Date.now();
          setReconnecting(true);
          setStatus(NET_COPY.reconnecting);
        } else if (cs === "failed") {
          failCountRef.current += 1;
          setReconnecting(true);
          setStatus(NET_COPY.reconnecting);
          report("ice_failed", { iceState: cs });
        }
      };
    },
    [attachRemote, postSignal, report]
  );

  const ensurePc = useCallback(async () => {
    if (pcRef.current) return pcRef.current;
    const iceServers = await loadIce();
    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 4,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });
    bindPc(pc);
    const stream = streamRef.current;
    if (stream) stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pcRef.current = pc;
    return pc;
  }, [bindPc, loadIce]);

  const rebuildPc = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream || !joinedRef.current) return;
    lastReconnectRef.current = Date.now();
    report("reconnect", { iceState: iceStateRef.current });
    pcRef.current?.close();
    pcRef.current = null;
    offerSentRef.current = false;
    answeredRef.current = false;
    connectedRef.current = false;
    sessionRef.current = newSession();
    const pc = await ensurePc();
    void applyMediaTier(videoTierRef.current);
    if (roleRef.current === "doctor") await sendOffer(true);
    else await postSignal("join", wrapSignal(sessionRef.current, { at: Date.now(), quality: quality }));
    return pc;
  }, [applyMediaTier, ensurePc, postSignal, quality, report, sendOffer]);

  const handleRemote = useCallback(
    async (msg: SignalMsg) => {
      if (msg.from === roleRef.current) return;
      if (msg.type === "here") {
        setPeerOnPage(true);
        const hint = parsePeerNetHint(unwrapSignal(msg.payload).body);
        if (hint) setPeerQuality(hint);
        if (!joinedRef.current && roleRef.current === "doctor") {
          setStatus("Paciente abriu o link. Peça para tocar em Entrar na consulta.");
        }
        return;
      }
      if (msg.type === "join") {
        setPeerOnPage(true);
        setPeerInCall(true);
        setPeerLeft(false);
        if (roleRef.current === "doctor" && joinedRef.current) {
          setStatus("Paciente na sala. Conectando vídeo…");
          await ensurePc();
          await sendOffer(false);
        }
        return;
      }
      if (msg.type === "leave") {
        setPeerInCall(false);
        setHasRemote(false);
        setPeerLeft(true);
        setStatus("O outro participante saiu. A sala e o prontuário continuam abertos.");
        if (remoteVideo.current) remoteVideo.current.srcObject = null;
        connectedRef.current = false;
        answeredRef.current = false;
        report("peer_left");
        return;
      }
      if (!joinedRef.current) return;
      const { body } = unwrapSignal(msg.payload);
      const pc = await ensurePc();
      if (msg.type === "offer" && body) {
        try {
          await pc.setRemoteDescription(body as RTCSessionDescriptionInit);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await postSignal("answer", wrapSignal(sessionRef.current, answer));
          setStatus("Resposta enviada. Aguardando imagem…");
        } catch {
          /* offer velho */
        }
      } else if (msg.type === "answer" && body) {
        answeredRef.current = true;
        if (pc.signalingState === "have-local-offer") {
          try {
            await pc.setRemoteDescription(body as RTCSessionDescriptionInit);
          } catch {
            /* ignore */
          }
        }
        setStatus("Paciente na chamada. Cruzando o vídeo…");
      } else if (msg.type === "ice" && body) {
        if (!pc.remoteDescription) return;
        try {
          await pc.addIceCandidate(body as RTCIceCandidateInit);
        } catch {
          /* ignore */
        }
      }
    },
    [ensurePc, postSignal, report, sendOffer]
  );

  const pullSignals = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const res = await fetch(
        `/api/signaling?roomId=${roomId}&after=${encodeURIComponent(lastPoll.current)}`
      );
      const data = await res.json();
      const raw = (data.messages || []) as SignalMsg[];
      for (const msg of raw) lastPoll.current = msg.createdAt;
      for (const msg of playbackSignals(raw)) {
        await handleRemote(msg);
      }
    } catch {
      /* próximo ciclo */
    } finally {
      pollingRef.current = false;
    }
  }, [handleRemote, roomId]);

  useEffect(() => {
    if (!info) return;
    void postPresence(joinedRef.current);
    const beat = setInterval(() => void postPresence(joinedRef.current), 6000);
    return () => clearInterval(beat);
  }, [info, joined, postPresence]);

  useEffect(() => {
    if (!joined) return;
    lastPoll.current = "";
    void pullSignals();
    const ms = pollIntervalMs(phase);
    const timer = setInterval(() => void pullSignals(), ms);
    return () => clearInterval(timer);
  }, [joined, phase, pullSignals]);

  useEffect(() => {
    if (!joined || role !== "doctor") return;
    const retry = setInterval(() => {
      if (connectedRef.current) return;
      if (!peerInCall) return;
      void sendOffer(Boolean(answeredRef.current || iceStateRef.current === "failed" || iceStateRef.current === "disconnected"));
    }, 8000);
    return () => clearInterval(retry);
  }, [joined, peerInCall, role, sendOffer]);

  useEffect(() => {
    if (!joined) return;
    const timer = setInterval(() => {
      const action = reconnectAction({
        ice: iceStateRef.current,
        failCount: failCountRef.current,
        lastAttemptAt: lastReconnectRef.current,
        disconnectedSince: disconnectedSinceRef.current || null,
      });
      if (action === "none") return;
      lastReconnectRef.current = Date.now();
      report("reconnect", { iceState: iceStateRef.current });
      if (action === "ice-restart") {
        if (roleRef.current === "doctor") void sendOffer(true);
        else void postSignal("join", wrapSignal(sessionRef.current, { at: Date.now() }));
      } else {
        void rebuildPc();
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [joined, postSignal, rebuildPc, report, sendOffer]);

  useEffect(() => {
    if (!joined) return;
    const onOffline = () => {
      if (!disconnectedSinceRef.current) disconnectedSinceRef.current = Date.now();
      setReconnecting(true);
      setStatus(NET_COPY.reconnecting);
      report("offline");
    };
    const onOnline = () => {
      setStatus("Internet voltou. Tentando reconectar…");
      lastReconnectRef.current = Date.now();
      if (roleRef.current === "doctor") void sendOffer(true);
      else void rebuildPc();
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [joined, rebuildPc, report, sendOffer]);

  useEffect(() => {
    if (!joined) return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const ice = iceStateRef.current;
      if (ice === "disconnected" || ice === "failed" || ice === "closed") {
        setStatus(NET_COPY.reconnecting);
        setReconnecting(true);
        if (ice === "closed") void rebuildPc();
        else if (roleRef.current === "doctor") void sendOffer(true);
        else void postSignal("join", wrapSignal(sessionRef.current, { at: Date.now() }));
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [joined, postSignal, rebuildPc, sendOffer]);

  useEffect(() => {
    if (!joined) return;
    const timer = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let rttMs = 0;
        let lost = 0;
        let received = 0;
        let jitterMs = 0;
        let availableBitrate = Number.POSITIVE_INFINITY;
        stats.forEach((row) => {
          if (row.type === "candidate-pair" && (row as { state?: string }).state === "succeeded") {
            rttMs = Number((row as { currentRoundTripTime?: number }).currentRoundTripTime || 0) * 1000;
            const avail = Number((row as { availableOutgoingBitrate?: number }).availableOutgoingBitrate || 0);
            if (avail > 0) availableBitrate = avail;
          }
          if (row.type === "inbound-rtp") {
            lost += Number((row as { packetsLost?: number }).packetsLost || 0);
            received += Number((row as { packetsReceived?: number }).packetsReceived || 0);
            const j = Number((row as { jitter?: number }).jitter || 0) * 1000;
            if (j > jitterMs) jitterMs = j;
          }
        });
        const nextCounters: RtpCounters = { lost, received, jitterMs };
        const lossRatio = recentLossRatio(prevRtpRef.current, nextCounters);
        prevRtpRef.current = nextCounters;
        const q = qualityFromStats({ rttMs, lossRatio, jitterMs, availableBitrate });
        setQuality(q);
        if (q === "good") {
          goodTicksRef.current += 1;
          poorTicksRef.current = 0;
        } else {
          poorTicksRef.current += 1;
          goodTicksRef.current = 0;
        }
        const nextTier = nextVideoTier(
          videoTierRef.current,
          q,
          poorTicksRef.current,
          goodTicksRef.current
        );
        if (nextTier !== videoTierRef.current) {
          poorTicksRef.current = 0;
          goodTicksRef.current = 0;
          void applyMediaTier(nextTier);
        }
        void postSignal("here", wrapSignal(sessionRef.current, { quality: q, audioOnly: videoTierRef.current >= 4 }));
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [applyMediaTier, joined, postSignal]);

  function stopCallMedia(keepPage = false) {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    offerSentRef.current = false;
    answeredRef.current = false;
    connectedRef.current = false;
    setHasRemote(false);
    setReconnecting(false);
    setQuality(null);
    setPeerQuality(null);
    setNetAudioOnly(false);
    disconnectedSinceRef.current = 0;
    prevRtpRef.current = null;
    if (keepPage) {
      setJoined(false);
      joinedRef.current = false;
      setStatus("Vídeo encerrado. O prontuário continua aqui. Toque em Entrar para voltar à chamada.");
    }
  }

  function destinationAfterLeave() {
    return roleRef.current === "doctor" ? homePath : "/paciente/inicio";
  }

  async function endVideoStay() {
    if (!joinedRef.current) return;
    report("leave", { phase });
    try {
      await postSignal("leave", wrapSignal(sessionRef.current, {}));
      await postPresence(false);
    } catch {
      /* ignore */
    }
    stopCallMedia(true);
  }

  async function hangUp() {
    if (hungUp.current || leaving) return;
    if (!window.confirm("Sair da consulta? O vídeo encerra. A evolução já salva no prontuário permanece.")) return;
    hungUp.current = true;
    setLeaving(true);
    if (joinedRef.current) {
      try {
        await postSignal("leave", wrapSignal(sessionRef.current, {}));
        await postPresence(false);
      } catch {
        /* ignore */
      }
    }
    stopCallMedia(false);
    setJoined(false);
    joinedRef.current = false;
    router.push(destinationAfterLeave());
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      pcRef.current?.close();
      pcRef.current = null;
      if (!hungUp.current && joinedRef.current) {
        void fetch(`/api/rooms/${roomId}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: roleRef.current, pageOpen: false, inCall: false }),
          keepalive: true,
        });
      }
    };
  }, [roomId]);

  async function acquireMedia(withVideo: boolean) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints(withVideo));
      return stream;
    } catch (err) {
      if (withVideo) {
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia(mediaConstraints(false));
          setCamOff(true);
          return audioOnly;
        } catch (audioErr) {
          throw audioErr;
        }
      }
      throw err;
    }
  }

  async function joinCall(withVideo = true) {
    try {
      hungUp.current = false;
      userCamOffRef.current = !withVideo;
      setNetAudioOnly(!withVideo);
      setMediaHelp(null);
      setError("");
      setPeerLeft(false);
      sessionRef.current = newSession();
      setStatus("Pedindo câmera e microfone…");
      const stream = await acquireMedia(withVideo);
      stream.getAudioTracks().forEach((t) => {
        try {
          t.contentHint = "speech";
        } catch {
          /* ignore */
        }
      });
      stream.getVideoTracks().forEach((t) => {
        try {
          t.contentHint = "motion";
        } catch {
          /* ignore */
        }
      });
      streamRef.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;
      setJoined(true);
      joinedRef.current = true;
      await ensurePc();
      videoTierRef.current = withVideo ? DEFAULT_VIDEO_TIER : 4;
      setNetAudioOnly(!withVideo);
      void applyMediaTier(videoTierRef.current);
      await postSignal("join", wrapSignal(sessionRef.current, { at: Date.now() }));
      await postPresence(true);
      report("join", { phase: "connecting" });
      if (roleRef.current === "doctor") {
        if (peerInCall) await sendOffer(false);
        else {
          setStatus(
            peerOnPage
              ? "Paciente abriu o link. Aguardando ele tocar em Entrar na consulta…"
              : "Aguardando o paciente entrar…"
          );
        }
      } else {
        setStatus(`Câmera ligada. Aguardando ${hostLabel.toLowerCase()} conectar…`);
      }
    } catch (err) {
      const help = explainMediaError(err);
      setMediaHelp(help);
      report("media_denied");
      setJoined(false);
      joinedRef.current = false;
    }
  }

  function toggleMute() {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }

  function toggleCam() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    if (netAudioOnly) return;
    track.enabled = !track.enabled;
    userCamOffRef.current = !track.enabled;
    setCamOff(!track.enabled);
  }

  async function copyLink() {
    const url = patientInviteUrl(window.location.href);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isDoctor = role === "doctor";
  const otherName = isDoctor ? info?.patientName || "o paciente" : hostLabel;
  const sairButton = (
    <button
      type="button"
      className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--danger)] px-5 text-sm font-extrabold text-white shadow-sm transition hover:brightness-95 disabled:opacity-50"
      onClick={() => void hangUp()}
      disabled={leaving}
    >
      {leaving ? "Saindo…" : "Sair da consulta"}
    </button>
  );

  async function confirmPixAndStay() {
    setConfirmingPix(true);
    setConfirmErr("");
    try {
      const res = await fetch(`/api/care-rooms/${roomId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível confirmar o Pix.");
      setHostPay((prev) => (prev ? { ...prev, status: "confirmed" } : prev));
      setStatus("Pix conferido. Entre para atender o paciente.");
    } catch (e) {
      setConfirmErr(e instanceof Error ? e.message : "Não foi possível confirmar.");
    } finally {
      setConfirmingPix(false);
    }
  }

  if (awaitingHost) {
    return (
      <div className="mx-auto max-w-md px-5 py-16">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Consulta da equipe</p>
        <h1 className="font-display mt-2 text-2xl font-extrabold text-[var(--text)]">Pix enviado</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          O {hostLabel.toLowerCase()} vai conferir o valor na chave Pix cadastrada e liberar a sala.
        </p>
        <button type="button" className="btn-gold mt-6 w-full" onClick={() => window.location.reload()}>
          Já liberou? Atualizar
        </button>
        <Link href="/paciente/inicio" className="mt-4 inline-block text-sm font-semibold text-[var(--gold)]">
          ← Voltar
        </Link>
      </div>
    );
  }

  if (paywall) {
    return (
      <div className="mx-auto max-w-md px-5 py-16">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{paywall.isReturn ? "Retorno da equipe" : "Consulta da equipe"}</p>
        <h1 className="font-display mt-2 text-2xl font-extrabold text-[var(--text)]">Pague o Pix para entrar</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          O valor vai para a chave Pix cadastrada de {paywall.holderName} — não para o médico nem para a plataforma.
        </p>
        <div className="mt-6">
          <PixCheckout
            pix={paywall}
            onPaid={async () => {
              const res = await fetch(`/api/care-rooms/${roomId}/pay`, { method: "POST" });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data.error || "Não foi possível confirmar o Pix.");
              window.location.reload();
            }}
          />
        </div>
        <Link href="/paciente/inicio" className="mt-6 inline-block text-sm font-semibold text-[var(--gold)]">
          ← Voltar
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20">
        <p className="text-red-600">{error}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn-gold" onClick={() => window.location.reload()}>
            Tentar de novo
          </button>
          {sairButton}
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto px-5 py-8 ${isDoctor ? "max-w-7xl" : "max-w-5xl"} ${joined ? "pb-28 lg:pb-10" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
            Sala Meu Rim
          </p>
          <h1 className="font-display mt-2 text-3xl text-[var(--text)] sm:text-4xl">
            Consulta online
          </h1>
        </div>
        {sairButton}
      </div>
      {info && (
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {info.doctorName} · {info.patientName}
          {info.careReason ? ` · ${CARE_REASON[info.careReason] || info.careReason}` : ""}
          {" · "}
          {formatSlotLabel(info.slotStart)}
        </p>
      )}
      <p className="mt-3 text-sm text-[var(--gold-light)]">{notice?.text || status}</p>
      {isDoctor && (
        <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">
          {peerInCall
            ? "Paciente já entrou na chamada."
            : peerOnPage
              ? "Paciente abriu o link — ainda precisa tocar em Entrar na consulta."
              : "Paciente ainda não abriu o link da sala."}
        </p>
      )}
      {embeddedBrowser && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Abra no Chrome ou Safari para o vídeo funcionar.</p>
          <p className="mt-1">
            O navegador do WhatsApp/Instagram costuma bloquear câmera entre as duas pontas. Toque em
            {" "}<b>Abrir no navegador</b> e depois em Entrar na consulta.
          </p>
          <button type="button" className="btn-gold mt-3 min-h-11" onClick={() => void copyLink()}>
            {copied ? "Link copiado" : "Copiar link para abrir no navegador"}
          </button>
        </div>
      )}
      {mediaHelp && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
          <p className="font-semibold">{mediaHelp.title}</p>
          <p className="mt-1">{mediaHelp.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {mediaHelp.canRetry && (
              <button type="button" className="btn-gold min-h-11" onClick={() => void joinCall(true)}>
                Tentar de novo
              </button>
            )}
            {mediaHelp.allowAudioOnly && (
              <button type="button" className="btn-ghost min-h-11" onClick={() => void joinCall(false)}>
                Entrar só com áudio
              </button>
            )}
          </div>
        </div>
      )}
      {isDoctor && hostPay && hostPay.status !== "free" && hostPay.priceCents > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {hostPay.status === "confirmed" ? (
            <p>Pix de R$ {(hostPay.priceCents / 100).toFixed(2).replace(".", ",")} conferido na sua chave. Pode atender.</p>
          ) : hostPay.status === "declared" ? (
            <p>
              Paciente declarou o Pix de R$ {(hostPay.priceCents / 100).toFixed(2).replace(".", ",")} para {hostPay.holderName}.
              Confira na sua conta e confirme o recebimento.
            </p>
          ) : (
            <p>
              Aguardando o paciente pagar R$ {(hostPay.priceCents / 100).toFixed(2).replace(".", ",")} na sua chave Pix.
              Você já pode entrar e esperar.
            </p>
          )}
          {hostPay.status !== "confirmed" && (
            <button
              type="button"
              className="btn-gold mt-3 min-h-11"
              disabled={confirmingPix}
              onClick={() => void confirmPixAndStay()}
            >
              {confirmingPix ? "Confirmando…" : "Recebi o Pix"}
            </button>
          )}
          {confirmErr && <p className="mt-2 font-semibold text-[var(--danger)]">{confirmErr}</p>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {role === "doctor" && (
          <button type="button" className="btn-ghost !min-h-[42px] !text-xs" onClick={() => void copyLink()}>
            {copied ? "Link do paciente copiado" : "Copiar link do paciente"}
          </button>
        )}
        {joined && (
          <>
            <button type="button" className="btn-ghost !min-h-[42px] !text-xs" onClick={toggleMute}>
              {muted ? "Ativar microfone" : "Mutar"}
            </button>
            <button type="button" className="btn-ghost !min-h-[42px] !text-xs" onClick={toggleCam}>
              {camOff ? "Ligar câmera" : "Desligar câmera"}
            </button>
            <button type="button" className="btn-ghost !min-h-[42px] !text-xs" onClick={() => void endVideoStay()}>
              Encerrar vídeo e ficar
            </button>
          </>
        )}
      </div>

      {!joined && (
        <div className="mt-6">
          {!isDoctor && (
            <p className="mb-3 max-w-lg text-sm text-[var(--text)]">
              Você é o paciente desta consulta. Toque no botão para ligar câmera e microfone — só assim o {hostLabel.toLowerCase()} te vê.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-gold min-h-12 px-8 text-base" onClick={() => void joinCall(true)}>
              {isDoctor ? "Entrar para atender" : "Entrar na consulta"}
            </button>
            <button type="button" className="btn-ghost min-h-12" onClick={() => void joinCall(false)}>
              Entrar só com áudio
            </button>
            {roomRole === "guest" && !forcePatient && (
              <Link
                href={`${loginPath}?next=/consulta/${roomId}`}
                className="text-sm font-semibold text-[var(--gold)] underline"
              >
                Sou {hostLabel.toLowerCase()}
              </Link>
            )}
          </div>
        </div>
      )}

      <div className={`mt-8 ${isDoctor ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]" : ""}`}>
        <ConsultVideoStage
          isDoctor={isDoctor}
          phase={phase}
          hostLabel={hostLabel}
          otherName={otherName}
          localName={isDoctor ? "Você" : "Você (paciente)"}
          remoteName={isDoctor ? info?.patientName || "Paciente" : hostLabel}
          localVideo={localVideo}
          remoteVideo={remoteVideo}
          hasRemote={hasRemote}
          quality={quality}
          notice={notice}
          audioOnly={netAudioOnly}
        />
        {isDoctor && roomKind === "doctor" && info?.patientEmail && (
          <ConsultChartPanel patientEmail={info.patientEmail} />
        )}
        {isDoctor && roomKind !== "doctor" && info?.patientKey && (
          <CareConsultPanel kind={roomKind} patientKey={info.patientKey} />
        )}
      </div>

      {(showTestHint || (isDoctor && !turnReady && joined)) && (
        <p className="mt-6 text-xs text-[var(--text-muted)]">
          {turnReady
            ? "TURN ativo — ajuda em rede difícil (4G, Wi‑Fi de condomínio)."
            : "Sem TURN no servidor: em algumas redes o vídeo pode demorar ou falhar. Os dois devem usar Chrome ou Safari."}
        </p>
      )}

      {joined && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(14,49,68,0.08)] lg:hidden">
          <div className="mx-auto flex max-w-5xl gap-2">
            <button type="button" className="btn-ghost !min-h-[44px] flex-1 !px-3 !text-xs" onClick={toggleMute}>
              {muted ? "Microfone" : "Mutar"}
            </button>
            <button type="button" className="btn-ghost !min-h-[44px] flex-1 !px-3 !text-xs" onClick={toggleCam}>
              {camOff ? "Câmera" : "Câmera off"}
            </button>
            <button
              type="button"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-[var(--danger)] px-3 text-xs font-extrabold text-white disabled:opacity-50"
              onClick={() => void hangUp()}
              disabled={leaving}
            >
              {leaving ? "Saindo…" : "Sair"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
