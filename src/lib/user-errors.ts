// Tratamento de erros para o usuário final (paciente/médico/admin).
// Regra do projeto: NENHUM erro técnico bruto pode aparecer na interface.
// A mensagem técnica vai para console.error (depuração); o usuário vê PT-BR amigável.

/** Erro com mensagem já amigável (em português), seguro para exibir ao usuário. */
export class FriendlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FriendlyError";
  }
}

const GENERIC = "Algo deu errado. Tente novamente em instantes.";
const NETWORK = "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";

/**
 * Converte qualquer erro em uma mensagem amigável em português.
 * Erros de rede/URL/parse (incl. "The string did not match the expected pattern")
 * viram mensagens claras; o erro cru é sempre registrado via console.error.
 */
export function toFriendlyMessage(err: unknown, fallback: string = GENERIC): string {
  if (err instanceof FriendlyError) return err.message;
  try {
    console.error("[erro tratado]", err);
  } catch {
    /* ignore */
  }
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err ?? "");
  const s = raw.toLowerCase();
  if (/failed to fetch|networkerror|network request failed|load failed|err_internet|err_network|timeout|timed out/.test(s)) {
    return NETWORK;
  }
  return fallback;
}

/**
 * POST JSON blindado: nunca lança DOMException/erro de parse para quem chama.
 * - Falha de rede → FriendlyError (mensagem de internet).
 * - Resposta não-OK → FriendlyError com a mensagem do backend (já amigável) ou padrão.
 * - Corpo vazio/HTML → tratado sem quebrar o JSON.parse.
 */
export async function postJson<T = Record<string, unknown>>(
  url: string,
  body: unknown,
  notOkFallback: string = "Não foi possível concluir agora. Tente novamente."
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch (networkErr) {
    console.error("[postJson] falha de rede:", url, networkErr);
    throw new FriendlyError(NETWORK);
  }
  const text = await res.text().catch(() => "");
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }
  if (!res.ok) {
    const serverMsg = typeof data.error === "string" && data.error.trim() ? data.error : notOkFallback;
    throw new FriendlyError(serverMsg);
  }
  return data as T;
}
