import { NextResponse } from "next/server";
import { getHdActor, hdPerm } from "@/lib/hd-access";
import {
  ensureHdSession,
  hdAddLabs,
  hdAddMember,
  hdAddPatient,
  hdCloseMonth,
  hdConfirmLab,
  hdDashboard,
  hdGetSettings,
  hdLinkMeuRimPatients,
  hdListAudit,
  hdListExams,
  hdListHistory,
  hdListMap,
  hdListMonths,
  hdListPatients,
  hdListTeam,
  hdMeuRimPatients,
  hdPatientDetail,
  hdPeekMenu,
  hdReviewPatient,
  hdReviewQueue,
  hdSaveSettings,
  hdSearchDoctors,
  hdUpdateMapCell,
  hdUpdateMember,
  requireHd,
} from "@/lib/hd-store";
import type { HdExamCode, HdMapField, HdReviewDecision, HdRole, HdShift } from "@/lib/hd-types";
import { HD_EXAM_CODES, HD_MAP_FIELDS } from "@/lib/hd-types";

function num(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function shiftOf(v: string | null): HdShift | "ALL" | undefined {
  if (!v || v === "ALL" || v === "todos") return "ALL";
  if (v === "MANHA" || v === "TARDE" || v === "NOITE") return v;
  if (v === "1") return "MANHA";
  if (v === "2") return "TARDE";
  if (v === "3") return "NOITE";
  return "ALL";
}

export async function GET(req: Request) {
  const actor = await getHdActor();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const url = new URL(req.url);
  const view = url.searchParams.get("view") || "session";
  const year = num(url.searchParams.get("year"));
  const month = num(url.searchParams.get("month"));
  const shift = shiftOf(url.searchParams.get("shift"));
  const q = url.searchParams.get("q") || "";

  if (view === "session") {
    const peek = await hdPeekMenu(actor);
    if (!peek.allowed) return NextResponse.json({ allowed: false, doctor: { name: actor.name } });
    if (!peek.bootstrapped && url.searchParams.get("bootstrap") !== "1") {
      return NextResponse.json({ allowed: true, bootstrapped: false, doctor: { name: actor.name, email: actor.email } });
    }
    const ses = await ensureHdSession(actor);
    return NextResponse.json({
      allowed: ses.allowed,
      bootstrapped: true,
      unit: ses.unit,
      member: ses.member ? { id: ses.member.id, name: ses.member.name, role: ses.member.role, status: ses.member.status } : null,
      perms: ses.perms,
      doctor: { name: actor.name, email: actor.email },
    });
  }

  const ctx = await requireHd(actor);
  if (!ctx) return NextResponse.json({ error: "Sem acesso à Hemodiálise." }, { status: 403 });

  try {
    if (view === "dashboard") {
      if (!hdPerm(ctx.member, "view_patients", actor.isSuperAdmin)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      return NextResponse.json(await hdDashboard(ctx, year, month, shift, q));
    }
    if (view === "patients") return NextResponse.json({ patients: await hdListPatients(ctx, shift, q, year, month) });
    if (view === "patient") {
      const id = url.searchParams.get("id") || "";
      const detail = await hdPatientDetail(ctx, id, year, month);
      if (!detail) return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
      return NextResponse.json(detail);
    }
    if (view === "map") {
      if (!hdPerm(ctx.member, "view_map", actor.isSuperAdmin) && ctx.member.role === "LABORATORIO") {
        return NextResponse.json({ error: "Laboratório não acessa o mapa." }, { status: 403 });
      }
      return NextResponse.json(await hdListMap(ctx, year, month, shift, q));
    }
    if (view === "team") {
      if (!hdPerm(ctx.member, "manage_team", actor.isSuperAdmin) && !hdPerm(ctx.member, "view_patients", actor.isSuperAdmin)) {
        return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      }
      return NextResponse.json({ members: await hdListTeam(ctx) });
    }
    if (view === "doctors") return NextResponse.json({ doctors: await hdSearchDoctors(q) });
    if (view === "meurim-patients") return NextResponse.json({ patients: await hdMeuRimPatients(ctx) });
    if (view === "exams") {
      if (!hdPerm(ctx.member, "view_exams", actor.isSuperAdmin)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      return NextResponse.json(await hdListExams(ctx, year, month));
    }
    if (view === "review") {
      if (!hdPerm(ctx.member, "review", actor.isSuperAdmin)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      return NextResponse.json(await hdReviewQueue(ctx, year, month, shift));
    }
    if (view === "history") {
      if (!hdPerm(ctx.member, "view_history", actor.isSuperAdmin)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      return NextResponse.json({ months: await hdListHistory(ctx) });
    }
    if (view === "audit") {
      if (!hdPerm(ctx.member, "view_audit", actor.isSuperAdmin)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      return NextResponse.json({ logs: await hdListAudit(ctx) });
    }
    if (view === "settings") return NextResponse.json(await hdGetSettings(ctx));
    if (view === "months") return NextResponse.json({ months: await hdListMonths(ctx) });
    return NextResponse.json({ error: "Vista inválida." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha na Hemodiálise.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const actor = await getHdActor();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const action = String(body.action || "");
  const year = typeof body.year === "number" ? body.year : undefined;
  const month = typeof body.month === "number" ? body.month : undefined;
  const ctx = await requireHd(actor);
  if (!ctx) return NextResponse.json({ error: "Sem acesso à Hemodiálise." }, { status: 403 });

  try {
    if (action === "add_member") {
      if (!hdPerm(ctx.member, "manage_team", actor.isSuperAdmin)) return NextResponse.json({ error: "Sem permissão para gerenciar a equipe." }, { status: 403 });
      const member = await hdAddMember(ctx, {
        email: String(body.email || ""),
        name: body.name ? String(body.name) : undefined,
        role: (body.role as HdRole) || "ENFERMAGEM",
        functionLabel: body.functionLabel ? String(body.functionLabel) : undefined,
        permissions: (body.permissions as Record<string, boolean>) || undefined,
      });
      return NextResponse.json({ member });
    }
    if (action === "update_member") {
      if (!hdPerm(ctx.member, "manage_team", actor.isSuperAdmin)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      const member = await hdUpdateMember(ctx, String(body.memberId || ""), {
        role: body.role as HdRole | undefined,
        functionLabel: body.functionLabel != null ? String(body.functionLabel) : undefined,
        permissions: (body.permissions as Record<string, boolean>) || undefined,
        status: body.status === "inactive" || body.status === "active" ? body.status : undefined,
      });
      return NextResponse.json({ member });
    }
    if (action === "update_map") {
      const field = String(body.field || "") as HdMapField;
      if (!HD_MAP_FIELDS.includes(field)) return NextResponse.json({ error: "Campo inválido." }, { status: 400 });
      const row = await hdUpdateMapCell(ctx, String(body.rowId || ""), field, String(body.value ?? ""), body.justification ? String(body.justification) : undefined);
      return NextResponse.json({ row });
    }
    if (action === "add_patient") {
      const patient = await hdAddPatient(ctx, {
        name: String(body.name || ""),
        patientId: body.patientId ? String(body.patientId) : null,
        notes: body.notes ? String(body.notes) : undefined,
      });
      return NextResponse.json({ patient });
    }
    if (action === "link_patients") {
      return NextResponse.json(await hdLinkMeuRimPatients(ctx));
    }
    if (action === "add_labs") {
      if (!hdPerm(ctx.member, "upload_exams", actor.isSuperAdmin) && !hdPerm(ctx.member, "confirm_ocr", actor.isSuperAdmin)) {
        return NextResponse.json({ error: "Sem permissão para enviar exames." }, { status: 403 });
      }
      const items = Array.isArray(body.items) ? body.items : [];
      const result = await hdAddLabs(
        ctx,
        items.map((it) => {
          const row = it as Record<string, unknown>;
          return {
            patientId: row.patientId ? String(row.patientId) : undefined,
            name: row.name ? String(row.name) : undefined,
            exam: String(row.exam || ""),
            value: String(row.value ?? ""),
            unit: row.unit ? String(row.unit) : undefined,
            date: row.date ? String(row.date) : undefined,
            confidence: typeof row.confidence === "number" ? row.confidence : 100,
            source: "manual" as const,
          };
        }),
        year,
        month
      );
      return NextResponse.json(result);
    }
    if (action === "confirm_lab") {
      if (!hdPerm(ctx.member, "confirm_ocr", actor.isSuperAdmin)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      const lab = await hdConfirmLab(ctx, String(body.labId || ""), body.value != null ? String(body.value) : undefined, body.reject === true);
      return NextResponse.json({ lab });
    }
    if (action === "review") {
      if (!hdPerm(ctx.member, "review", actor.isSuperAdmin)) return NextResponse.json({ error: "Sem permissão para revisar." }, { status: 403 });
      const rec = await hdReviewPatient(ctx, {
        patientId: String(body.patientId || ""),
        decision: (body.decision as HdReviewDecision) || "manter",
        notes: body.notes ? String(body.notes) : undefined,
        year,
        month,
        changes: (body.changes as Record<string, string>) || undefined,
      });
      return NextResponse.json({ review: rec });
    }
    if (action === "close_month") {
      if (!hdPerm(ctx.member, "close_month", actor.isSuperAdmin)) return NextResponse.json({ error: "Sem permissão para fechar o mês." }, { status: 403 });
      if (!year || !month) return NextResponse.json({ error: "Informe o mês." }, { status: 400 });
      const closed = await hdCloseMonth(ctx, year, month);
      return NextResponse.json({ month: closed });
    }
    if (action === "save_settings") {
      if (!hdPerm(ctx.member, "manage_config", actor.isSuperAdmin)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      const expected = Array.isArray(body.expectedExams)
        ? (body.expectedExams as string[]).filter((c): c is HdExamCode => HD_EXAM_CODES.includes(c as HdExamCode))
        : undefined;
      const settings = await hdSaveSettings(ctx, {
        centerName: body.centerName ? String(body.centerName) : undefined,
        unitName: body.unitName ? String(body.unitName) : undefined,
        expectedExams: expected,
      });
      return NextResponse.json({ settings });
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha na Hemodiálise.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
