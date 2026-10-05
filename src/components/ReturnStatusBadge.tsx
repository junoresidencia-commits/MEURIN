"use client";

import { STATUS_LABEL, STATUS_TONE, type ReturnRequestStatus } from "@/lib/return-request-types";

const TONE: Record<ReturnRequestStatus, string> = {
  pending_review: "bg-amber-50 text-amber-800 border-amber-200",
  awaiting_patient: "bg-orange-50 text-orange-800 border-orange-200",
  suggested_slot: "bg-sky-50 text-sky-800 border-sky-200",
  confirmed_return: "bg-emerald-50 text-emerald-800 border-emerald-200",
  awaiting_payment: "bg-violet-50 text-violet-800 border-violet-200",
  confirmed_new: "bg-emerald-50 text-emerald-800 border-emerald-200",
  refused: "bg-red-50 text-red-800 border-red-200",
  refused_deadline: "bg-red-50 text-red-800 border-red-200",
  cancelled: "bg-slate-50 text-slate-600 border-slate-200",
  closed: "bg-slate-50 text-slate-600 border-slate-200",
};

const DOT: Record<typeof STATUS_TONE[ReturnRequestStatus], string> = {
  yellow: "🟡",
  orange: "🟠",
  blue: "🔵",
  green: "🟢",
  pay: "💳",
  red: "🔴",
  gray: "⚫",
};

export function ReturnStatusBadge({ status }: { status: ReturnRequestStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${TONE[status]}`}>
      {DOT[STATUS_TONE[status]]} {STATUS_LABEL[status]}
    </span>
  );
}
