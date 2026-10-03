"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatSlotLabel } from "@/lib/scheduling-client";
import { ConsultChartPanel } from "@/components/ConsultChartPanel";
import { CareConsultPanel } from "@/components/CareConsultPanel";
import { PixCheckout } from "@/components/PixCheckout";

type Role = "doctor" | "patient";
type RoomRole = "doctor" | "patient" | "guest";
type RoomKind = "doctor" | "psychology" | "nursing" | "nutrition";
type IceServer = { urls: string | string[]; username?: string; credential?: string };

const CARE_REASON: Record<string, string> = {
  pressa: "Com pressa",
  acompanhamento: "Acompanhamento",
  segunda_opiniao: "2ª opinião",
  outro: "Outro",
};

export default function ConsultaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = params.id;
  const [showTestHint, setShowTestHint] = useState(false);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const roleRef = useRef<Role>("patient");
  const lastPoll = useRef("");
  const hungUp = useRef(false);
  const joinedRef = useRef(false);
  const iceRef = useRef<IceServer[] | null>(null);
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
  const [paywall, setPaywall] = useState<{
    brCode: string;
    qrDataUrl: string;
    amountCents: number;
    holderName: string;
  } | null>(null);
  const [hostAwaitingPay, setHostAwaitingPay] = useState<{ priceCents: number; holderName: string } | null>(null);

  useEffect(() => {
    setShowTestHint(new URLSearchParams(window.location.search).get("teste") === "1");
  }, []);

  useEffect(() => {
    fetch(`/api/rooms/${roomId}`)
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
              });
              return;
            }
          }
          throw new Error(data.error || "Sala indisponível");
        }
        const nextRole: Role = data.you?.role === "doctor" ? "doctor" : "patient";
        setRoomRole(data.you?.role || "guest");
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
        if (nextRole === "doctor" && data.payment?.status === "unpaid" && data.payment.priceCents > 0) {
          setHostAwaitingPay({
            priceCents: data.payment.priceCents,
            holderName: data.payment.holderName || data.doctor?.name || "você",
          });
        }
        setStatus(
          nextRole === "doctor"
            ? "Sala liberada. Entre para atender o paciente."
            : "Sala liberada. Entre quando estiver pronto."
        );
      })
      .catch((e) => setError(e.message));
  }, [roomId]);

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

  const ensurePc = useCallback(async () => {
    if (pcRef.current) return pcRef.current;
    const iceServers = await loadIce();
    const pc = new RTCPeerConnection({ iceServers });
    pc.onicecandidate = (ev) => {
      if (ev.candidate) void postSignal("ice", ev.candidate);
    };
    pc.ontrack = (ev) => {
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = ev.streams[0];
        setStatus("Conectado. Consulta em andamento.");
      }
    };
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") {
        setStatus("Conectado. Consulta em andamento.");
      } else if (state === "disconnected") {
        setStatus("Conexão instável. Tentando religar…");
      } else if (state === "failed") {
        setStatus("A conexão caiu. Peça para o outro lado entrar de novo.");
      }
    };
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      setCamOff(true);
    }
    streamRef.current = stream;
    if (localVideo.current) localVideo.current.srcObject = stream;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pcRef.current = pc;
    return pc;
  }, [loadIce, postSignal]);

  const handleRemote = useCallback(
    async (msg: { from: Role; type: string; payload: string; createdAt: string }) => {
      if (msg.from === roleRef.current) return;
      if (msg.type === "leave") {
        setStatus("O outro participante saiu da sala.");
        if (remoteVideo.current) remoteVideo.current.srcObject = null;
        return;
      }
      const pc = await ensurePc();
      const data = JSON.parse(msg.payload);
      if (msg.type === "offer") {
        await pc.setRemoteDescription(data);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await postSignal("answer", answer);
        setStatus("Resposta enviada. Aguardando imagem…");
      } else if (msg.type === "answer") {
        await pc.setRemoteDescription(data);
      } else if (msg.type === "ice") {
        try {
          await pc.addIceCandidate(data);
        } catch {
          /* ignore */
        }
      }
    },
    [ensurePc, postSignal]
  );

  useEffect(() => {
    if (!joined) return;
    const timer = setInterval(async () => {
      const res = await fetch(
        `/api/signaling?roomId=${roomId}&after=${encodeURIComponent(lastPoll.current)}`
      );
      const data = await res.json();
      for (const msg of data.messages || []) {
        lastPoll.current = msg.createdAt;
        await handleRemote(msg);
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [joined, roomId, handleRemote]);

  function stopCallMedia() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
  }

  function destinationAfterLeave() {
    return roleRef.current === "doctor" ? homePath : "/paciente/inicio";
  }

  async function hangUp() {
    if (hungUp.current || leaving) return;
    if (joinedRef.current && !window.confirm("Encerrar a consulta e sair da sala?")) return;
    hungUp.current = true;
    setLeaving(true);
    if (joinedRef.current) {
      try {
        await postSignal("leave", {});
      } catch {
        /* ignore */
      }
    }
    stopCallMedia();
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
        hungUp.current = true;
        void fetch("/api/signaling", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId,
            from: roleRef.current,
            type: "leave",
            payload: "{}",
          }),
          keepalive: true,
        });
      }
    };
  }, [roomId]);

  async function joinCall() {
    try {
      hungUp.current = false;
      setJoined(true);
      joinedRef.current = true;
      setStatus("Pedindo câmera e microfone…");
      const pc = await ensurePc();
      if (roleRef.current === "doctor") {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await postSignal("offer", offer);
        setStatus("Aguardando o paciente entrar…");
      } else {
        setStatus(`Aguardando ${hostLabel.toLowerCase()} iniciar a chamada…`);
      }
    } catch {
      setError(
        "Não foi possível acessar câmera ou microfone. Permita no navegador e tente de novo (HTTPS ou localhost)."
      );
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
    track.enabled = !track.enabled;
    setCamOff(!track.enabled);
  }

  async function copyLink() {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isDoctor = role === "doctor";
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

  if (paywall) {
    return (
      <div className="mx-auto max-w-md px-5 py-16">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Consulta da equipe</p>
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

  const videos = (
    <div className={isDoctor ? "relative" : "grid gap-4 lg:grid-cols-2"}>
      <div
        className={`relative overflow-hidden rounded-[24px] border border-[var(--border-gold)] bg-[#0a0a0a] ${
          isDoctor ? "aspect-video" : "aspect-video border-[var(--border)] bg-black lg:order-2"
        }`}
      >
        <video
          ref={isDoctor ? remoteVideo : localVideo}
          autoPlay
          muted={!isDoctor}
          playsInline
          className="h-full w-full object-cover"
        />
        <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
          {isDoctor ? info?.patientName || "Paciente" : "Você (paciente)"}
        </span>
      </div>
      <div
        className={
          isDoctor
            ? "absolute bottom-3 right-3 z-10 aspect-video w-[38%] max-w-[220px] overflow-hidden rounded-2xl border border-white/30 bg-black shadow-lg"
            : "relative aspect-video overflow-hidden rounded-[24px] border border-[var(--border-gold)] bg-[#0a0a0a]"
        }
      >
        <video
          ref={isDoctor ? localVideo : remoteVideo}
          autoPlay
          muted={isDoctor}
          playsInline
          className="h-full w-full object-cover"
        />
        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
          {isDoctor ? "Você" : hostLabel}
        </span>
      </div>
    </div>
  );

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
      <p className="mt-3 text-sm text-[var(--gold-light)]">{status}</p>
      {hostAwaitingPay && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Paciente ainda não declarou o Pix de R$ {(hostAwaitingPay.priceCents / 100).toFixed(2).replace(".", ",")} para {hostAwaitingPay.holderName}. Você já pode entrar.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {role === "doctor" && (
          <button type="button" className="btn-ghost !min-h-[42px] !text-xs" onClick={copyLink}>
            {copied ? "Link copiado" : "Copiar link da sala"}
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
          </>
        )}
      </div>

      {!joined && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-gold" onClick={() => void joinCall()}>
            {isDoctor ? "Entrar para atender" : "Entrar na consulta"}
          </button>
          {roomRole === "guest" && (
            <Link
              href={`${loginPath}?next=/consulta/${roomId}`}
              className="text-sm font-semibold text-[var(--gold)] underline"
            >
              Sou {hostLabel.toLowerCase()}
            </Link>
          )}
        </div>
      )}

      <div className={`mt-8 ${isDoctor ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]" : ""}`}>
        {videos}
        {isDoctor && roomKind === "doctor" && info?.patientEmail && (
          <ConsultChartPanel patientEmail={info.patientEmail} />
        )}
        {isDoctor && roomKind !== "doctor" && info?.patientKey && (
          <CareConsultPanel kind={roomKind} patientKey={info.patientKey} />
        )}
      </div>

      {showTestHint && (
        <p className="mt-6 text-xs text-[var(--text-muted)]">
          Modo teste: abra o link em dois aparelhos. {turnReady
            ? "TURN ativo — ajuda em rede difícil."
            : "Sem TURN configurado: em NAT difícil a imagem pode não cruzar."}
        </p>
      )}

      {joined && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(14,49,68,0.08)] lg:hidden">
          <div className="mx-auto flex max-w-5xl gap-2">
            <button
              type="button"
              className="btn-ghost !min-h-[44px] flex-1 !px-3 !text-xs"
              onClick={toggleMute}
            >
              {muted ? "Microfone" : "Mutar"}
            </button>
            <button
              type="button"
              className="btn-ghost !min-h-[44px] flex-1 !px-3 !text-xs"
              onClick={toggleCam}
            >
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
