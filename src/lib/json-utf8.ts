import { NextResponse } from "next/server";

/** JSON com charset UTF-8 explícito — evita mojibake (nÃ£o) no Safari/iOS. */
export function jsonUtf8(body: unknown, status = 200, extra?: HeadersInit) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      ...extra,
    },
  });
}
