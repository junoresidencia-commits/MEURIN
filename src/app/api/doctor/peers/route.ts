import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById, searchApprovedDoctors, toDoctorPublicCard } from "@/lib/store";
import { listPeers, setPeerActive, upsertPeer } from "@/lib/patient-shares-store";

export async function GET(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const specialty = url.searchParams.get("specialty")?.trim() || "";

  if (q.length >= 2 || specialty) {
    const doctors = await searchApprovedDoctors(q, doctorId, specialty || undefined);
    return NextResponse.json({ doctors });
  }

  const peers = await listPeers(doctorId);
  const doctors = [];
  for (const p of peers) {
    const d = await getDoctorById(p.peerId);
    if (d && (d.status ?? "approved") === "approved") {
      doctors.push({ ...toDoctorPublicCard(d), peerId: p.peerId, active: p.active, linkedAt: p.createdAt });
    }
  }
  return NextResponse.json({ doctors });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const peerId = String(body.peerId || body.doctorId || "").trim();
  if (!peerId) return NextResponse.json({ error: "Informe o médico." }, { status: 400 });
  if (peerId === doctorId) return NextResponse.json({ error: "Não é possível adicionar a si mesmo." }, { status: 400 });
  const peer = await getDoctorById(peerId);
  if (!peer || (peer.status ?? "approved") !== "approved") {
    return NextResponse.json({ error: "Médico não encontrado ou ainda não aprovado." }, { status: 404 });
  }
  await upsertPeer(doctorId, peerId);
  return NextResponse.json({ ok: true, doctor: toDoctorPublicCard(peer) }, { status: 201 });
}

export async function PATCH(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const peerId = String(body.peerId || body.doctorId || "").trim();
  if (!peerId) return NextResponse.json({ error: "Informe o médico." }, { status: 400 });
  await setPeerActive(doctorId, peerId, body.active !== false);
  return NextResponse.json({ ok: true });
}
