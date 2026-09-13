import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Status público, sem secrets. Para o aviso “estamos com dificuldade temporária”. */
export async function GET() {
  const sb = getSupabaseAdmin();
  let databaseOnline = true;
  if (sb) {
    const { error } = await sb.from("doctors").select("id", { count: "exact", head: true });
    databaseOnline = !error;
  }
  return NextResponse.json({
    ok: databaseOnline,
    databaseOnline,
    message: databaseOnline
      ? null
      : "Estamos com dificuldade temporária para carregar alguns dados. Seus registros já salvos continuam no banco.",
  });
}
