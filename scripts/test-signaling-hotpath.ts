import assert from "node:assert/strict";
import {
  appendSignalingMessage,
  getBookingById,
  getBookingByRoomId,
  listBookingsForDoctor,
  listDoctors,
  listSignalingForRoom,
} from "../src/lib/store";

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Recuse: este teste não pode apontar para Supabase (produção).");
    process.exit(1);
  }

  const roomA = "room-perf-a";
  const roomB = "room-perf-b";
  const t0 = new Date().toISOString();

  await appendSignalingMessage({
    id: "sig-a-1",
    roomId: roomA,
    from: "doctor",
    type: "offer",
    payload: "{\"sdp\":\"a\"}",
    createdAt: t0,
  });
  await appendSignalingMessage({
    id: "sig-b-1",
    roomId: roomB,
    from: "patient",
    type: "answer",
    payload: "{\"sdp\":\"b\"}",
    createdAt: new Date(Date.now() + 10).toISOString(),
  });

  const onlyA = await listSignalingForRoom(roomA);
  assert.ok(onlyA.some((m) => m.id === "sig-a-1"), "sala A vê o próprio sinal");
  assert.ok(!onlyA.some((m) => m.id === "sig-b-1"), "sala A não vê sinal da sala B");

  const after = await listSignalingForRoom(roomA, t0);
  assert.equal(after.length, 0, "after=createdAt não relê a mesma mensagem");

  const doctors = await listDoctors();
  const carlos = doctors.find((d) => d.email === "carlos@meurim.com");
  if (carlos) {
    const mine = await listBookingsForDoctor(carlos.id);
    assert.ok(Array.isArray(mine), "listBookingsForDoctor devolve array");
    if (mine[0]) {
      const byId = await getBookingById(mine[0].id);
      assert.equal(byId?.id, mine[0].id);
      const byRoom = await getBookingByRoomId(mine[0].meetingRoomId);
      assert.equal(byRoom?.id, mine[0].id);
    }
  }

  console.log("signaling-hotpath ok", { roomA: onlyA.length, doctors: doctors.length });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
