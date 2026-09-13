/** Segredo dos cookies. Na Vercel é obrigatório (já existe no projeto meurim). Localmente cai no fallback de demo. */
export function sessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;
  if (process.env.VERCEL) {
    throw new Error("SESSION_SECRET obrigatório na Vercel.");
  }
  return "meu-rim-dev-secret-change-me";
}
