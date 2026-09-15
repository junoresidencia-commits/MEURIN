"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatSlotLabel } from "@/lib/scheduling-client";
import { toFriendlyMessage } from "@/lib/user-errors";

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
  const [role, setRole] = useState<Role>("patient");
  const [info, setInfo] = useState<{
    patientName: string;
    doctorName: string;
    slotStart: string;
  } | null>(null);
  const [status, setStatus] = useState("Preparando sala…");
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [copied, setCopied] = useState(false);
  // Médico logado? (habilita salvar a evolução direto da sala)
  const [isDoctorLoggedIn, setIsDoctorLoggedIn] = useState(false);
  // Prontuário/evolução escrito na sala
  const [note, setNote] = useState({ chiefComplaint: "", history: "", assessment: "", plan: "" });
  const [shareNote, setShareNote] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [noteMsg, setNoteMsg] = useState("");
  const [noteErr, setNoteErr] = useState("");

  // Detecta médico logado para sugerir o papel e liberar a evolução.
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setIsDoctorLoggedIn(Boolean(d?.doctor)))
      .catch(() => {});
  }, []);

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

  async function joinAs(nextRole: Role) {
    try {
      setRole(nextRole);
      roleRef.current = nextRole;
      setJoined(true);
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

  function leave() {
    // Encerra câmera/microfone e a conexão, e sai da sala.
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
    } catch {
      /* ignore */
    }
    pcRef.current = null;
    streamRef.current = null;
    setJoined(false);
    router.push(roleRef.current === "doctor" ? "/medicos/painel" : "/");
  }

  async function saveNote() {
    setSavingNote(true);
    setNoteErr("");
    setNoteMsg("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...note, sharedWithPatient: shareNote }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar a evolução.");
      setNoteMsg("Evolução salva no prontuário.");
      setNote({ chiefComplaint: "", history: "", assessment: "", plan: "" });
    } catch (e) {
      setNoteErr(toFriendlyMessage(e, "Não foi possível salvar a evolução."));
    } finally {
      setSavingNote(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20">
        <p className="text-red-300">{error}</p>
        <button type="button" className="btn-gold mt-6" onClick={() => window.location.reload()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
        Sala Meu Rim
      </p>
      <h1 className="font-display mt-2 text-3xl text-[var(--text)] sm:text-4xl">
        Consulta online
      </h1>
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
            <button
              type="button"
              className="!min-h-[42px] rounded-full border border-[var(--danger)] px-4 !text-xs font-bold text-[var(--danger)] transition hover:bg-[var(--danger)] hover:text-white"
              onClick={leave}
            >
              Sair da consulta
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

      {isDoctorLoggedIn && (
        <section className="mt-8 rounded-[24px] border border-[var(--border)] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl text-[var(--text)]">Evolução da consulta</h2>
            <a href="/medicos/painel#pacientes" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[var(--gold)]">
              Abrir prontuário completo
            </a>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Queixa principal</span>
              <textarea className="input-field" rows={2} value={note.chiefComplaint} onChange={(e) => setNote({ ...note, chiefComplaint: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">História / evolução</span>
              <textarea className="input-field" rows={4} value={note.history} onChange={(e) => setNote({ ...note, history: e.target.value })} placeholder="Ex.: DRC G3b A3, Cr 1,8, K 4,8… conduta e orientações" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Avaliação</span>
                <textarea className="input-field" rows={3} value={note.assessment} onChange={(e) => setNote({ ...note, assessment: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Conduta / plano</span>
                <textarea className="input-field" rows={3} value={note.plan} onChange={(e) => setNote({ ...note, plan: e.target.value })} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
              <input type="checkbox" checked={shareNote} onChange={(e) => setShareNote(e.target.checked)} />
              Compartilhar esta evolução com o paciente
            </label>
            {noteMsg && <p className="text-sm font-semibold text-[var(--teal,#0d9488)]">{noteMsg}</p>}
            {noteErr && <p className="text-sm text-[var(--danger)]">{noteErr}</p>}
            <div>
              <button
                type="button"
                className="btn-gold disabled:opacity-50"
                onClick={saveNote}
                disabled={savingNote || (!note.chiefComplaint && !note.history && !note.assessment && !note.plan)}
              >
                {savingNote ? "Salvando…" : "Salvar evolução no prontuário"}
              </button>
            </div>
          </div>
        </section>
      )}

      <p className="mt-6 text-xs text-[var(--text-muted)]">
        Dica: abra o link em dois aparelhos (ou duas abas: paciente e médico) para
        testar. Em redes do interior, a qualidade pode variar — em produção
        vamos acrescentar servidor TURN.
      </p>
    </div>
  );
}
