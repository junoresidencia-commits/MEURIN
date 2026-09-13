const REDACT = /password|senha|token|secret|authorization|cookie|service_role|apikey|cpf/i;

export function safeLog(scope: string, err: unknown, extra?: Record<string, unknown>) {
  const detail: Record<string, unknown> = {};
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      detail[k] = REDACT.test(k) ? "[redacted]" : v;
    }
  }
  const message = err instanceof Error ? err.message : String(err);
  const cleaned = message.replace(/(Bearer\s+)\S+/gi, "$1[redacted]");
  console.error(`[${scope}]`, cleaned, Object.keys(detail).length ? detail : "");
}
