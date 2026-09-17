import { requireSuperAdmin } from "@/lib/platform-access";
import { runDocumentHealthCheck } from "@/lib/document-workflow/health";
import { DOCUMENT_REGISTRY } from "@/lib/document-workflow/registry";
import { jsonUtf8 } from "@/lib/json-utf8";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireSuperAdmin();
  if (!actor) return jsonUtf8({ error: "Sem permissão." }, 403);
  const report = await runDocumentHealthCheck();
  return jsonUtf8({
    ok: true,
    registrySize: DOCUMENT_REGISTRY.filter((d) => d.active).length,
    ...report,
  });
}
