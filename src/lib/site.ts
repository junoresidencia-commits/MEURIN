// URL oficial e única do Meu Rim. Fonte única de verdade para convites, QR Code,
// compartilhamento e links enviados ao paciente. Em produção, defina
// NEXT_PUBLIC_APP_URL; sem isso, cai no domínio oficial abaixo.
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://meurin.vercel.app").replace(/\/+$/, "");

/** Monta uma URL absoluta a partir de um caminho, usando a URL oficial. */
export function siteUrl(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${p}`;
}

/** Mensagem padrão de primeiro acesso do paciente (login por CPF + senha 123456). */
export function patientAccessMessage(patientName: string): string {
  const nome = (patientName || "").trim() || "paciente";
  return (
    `Olá, ${nome}!\n\n` +
    `Seu acesso ao Meu Rim já está disponível.\n\n` +
    `Acesse pelo celular ou computador:\n${SITE_URL}/\n\n` +
    `Login: seu CPF, somente com números\n` +
    `Senha provisória: 123456\n\n` +
    `No primeiro acesso, o sistema solicitará a criação de uma nova senha pessoal.\n\n` +
    `Pelo Meu Rim, você poderá acompanhar consultas, exames, medicamentos, documentos, orientações e a evolução da sua saúde renal.`
  );
}
