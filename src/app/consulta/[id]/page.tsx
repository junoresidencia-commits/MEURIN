"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatSlotLabel } from "@/lib/scheduling-client";

type Role = "doctor" | "patient";

export default function ConsultaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = params.id;
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const roleRef = useRef<Role>("patient");
  const lastPoll = useRef("");
  const hungUp = useRef(false);
  const joinedRef = useRef(false);
  const [role, setRole] = useState<Role>("patient");
  const [info, setInfo] = useState<{
    patientName: string;
    doctorName: string;
    slotStart: string;
  } | null>(null);
  const [status, setStatus] = useState("Preparando sala…");
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/rooms/${roomId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Sala indisponível");
        setInfo({
          patientName: data.booking.patientName,
          doctorName: data.doctor?.name || "Médico",
          slotStart: data.booking.slotStart,
        });
        setStatus("Sala liberada. Escolha seu papel e entre.");
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

  const ensurePc = useCallback(async () => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pc.onicecandidate = (ev) => {
      if (ev.candidate) void postSignal("ice", ev.candidate);
    };
    pc.ontrack = (ev) => {
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = ev.streams[0];
        setStatus("Conectado. Consulta em andamento.");
      }
    };
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    streamRef.current = stream;
    if (localVideo.current) localVideo.current.srcObject = stream;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pcRef.current = pc;
    return pc;
  }, [postSignal]);

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
    return roleRef.current === "doctor" ? "/medicos/agenda" : "/minhas-consultas";
  }

  async function hangUp() {
    if (hungUp.current || leaving) return;
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

  async function joinAs(nextRole: Role) {
    try {
      hungUp.current = false;
      setRole(nextRole);
      roleRef.current = nextRole;
      setJoined(true);
      joinedRef.current = true;
      setStatus("Pedindo câmera e microfone…");
      const pc = await ensurePc();
      if (nextRole === "doctor") {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await postSignal("offer", offer);
        setStatus("Aguardando o paciente entrar…");
      } else {
        setStatus("Aguardando o médico iniciar a chamada…");
      }
    } catch {
      setError(
        "Não foi possível acessar câmera/microfone. Permita no navegador e tente de novo (HTTPS ou localhost)."
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
    <div className={`mx-auto max-w-5xl px-5 py-10 ${joined ? "pb-28 lg:pb-10" : ""}`}>
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
          {info.doctorName} · {info.patientName} · {formatSlotLabel(info.slotStart)}
        </p>
      )}
      <p className="mt-3 text-sm text-[var(--gold-light)]">{status}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost !min-h-[42px] !text-xs" onClick={copyLink}>
          {copied ? "Link copiado" : "Copiar link da sala"}
        </button>
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
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn-gold" onClick={() => joinAs("patient")}>
            Entrar como paciente
          </button>
          <button type="button" className="btn-ghost" onClick={() => joinAs("doctor")}>
            Entrar como médico
          </button>
        </div>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="relative aspect-video overflow-hidden rounded-[24px] border border-[var(--border)] bg-black">
          <video
            ref={localVideo}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />
          <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
            Você ({role === "doctor" ? "médico" : "paciente"})
          </span>
        </div>
        <div className="relative aspect-video overflow-hidden rounded-[24px] border border-[var(--border-gold)] bg-[#0a0a0a]">
          <video
            ref={remoteVideo}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
          <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
            Outro participante
          </span>
        </div>
      </div>

      <p className="mt-6 text-xs text-[var(--text-muted)]">
        Dica: abra o link em dois aparelhos (ou duas abas: paciente e médico) para
        testar. Em redes do interior, a qualidade pode variar — em produção
        vamos acrescentar servidor TURN.
      </p>

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
