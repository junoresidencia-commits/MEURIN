import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type PresenceRole = "doctor" | "patient";

export type RoomPeerPresence = {
  role: PresenceRole;
  pageOpen: boolean;
  inCall: boolean;
  lastSeen: string;
};

const mem = new Map<string, RoomPeerPresence>();

function key(roomId: string, role: PresenceRole) {
  return `${roomId}:${role}`;
}

export async function upsertRoomPresence(input: {
  roomId: string;
  role: PresenceRole;
  pageOpen: boolean;
  inCall: boolean;
}): Promise<RoomPeerPresence> {
  const row: RoomPeerPresence = {
    role: input.role,
    pageOpen: input.pageOpen,
    inCall: input.inCall,
    lastSeen: new Date().toISOString(),
  };
  mem.set(key(input.roomId, input.role), row);

  const sb = getSupabaseAdmin();
  if (sb) {
    const { error } = await sb.from("room_presence").upsert(
      {
        room_id: input.roomId,
        role: input.role,
        page_open: input.pageOpen,
        in_call: input.inCall,
        last_seen: row.lastSeen,
      },
      { onConflict: "room_id,role" }
    );
    if (error) {
      console.error("[presence] upsert", error.message || error);
    }
  }
  return row;
}

export async function listRoomPresence(roomId: string): Promise<RoomPeerPresence[]> {
  const sb = getSupabaseAdmin();
  if (sb) {
    const { data, error } = await sb.from("room_presence").select("*").eq("room_id", roomId);
    if (error) {
      console.error("[presence] list", error.message || error);
    } else if (data) {
      return data.map((r) => ({
        role: String(r.role) as PresenceRole,
        pageOpen: Boolean(r.page_open),
        inCall: Boolean(r.in_call),
        lastSeen: new Date(String(r.last_seen)).toISOString(),
      }));
    }
  }
  return ["doctor", "patient"].flatMap((role) => {
    const row = mem.get(key(roomId, role as PresenceRole));
    return row ? [row] : [];
  });
}
