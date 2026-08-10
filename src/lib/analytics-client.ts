/** Cliente leve de analytics — falha silenciosa, não bloqueia a UI. */

export function trackEvent(
  type: string,
  props?: Record<string, string | number | boolean | null | undefined>
) {
  try {
    if (typeof window === "undefined") return;
    const meta: Record<string, string | number | boolean | null> = {};
    let doctorId: string | undefined;
    let bookingId: string | undefined;
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v === undefined) continue;
        if (k === "doctorId" && typeof v === "string") {
          doctorId = v;
          continue;
        }
        if (k === "bookingId" && typeof v === "string") {
          bookingId = v;
          continue;
        }
        meta[k] = v;
      }
    }
    const body = JSON.stringify({
      type,
      path: window.location.pathname + window.location.search,
      doctorId,
      bookingId,
      meta: Object.keys(meta).length ? meta : undefined,
    });
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/analytics", blob);
      return;
    }
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}
