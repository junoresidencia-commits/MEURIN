import "server-only";
import { createHash } from "crypto";

export type ConsentType = "terms" | "privacy" | "telehealth";

export const CONSENT_LABEL: Record<ConsentType, string> = {
  terms: "Termos de Uso",
  privacy: "Política de Privacidade",
  telehealth: "Termo de Consentimento para Teleconsulta",
};

/**
 * Textos oficiais versionados. NUNCA edite um texto já publicado: crie uma nova
 * versão (ex.: "1.1") — o histórico e os hashes antigos precisam ser preservados.
 * Texto-base: requer revisão jurídica (LGPD/CFM) antes de produção.
 */
type DocDef = { type: ConsentType; version: string; title: string; body: string };

const DOCS: DocDef[] = [
  {
    type: "terms",
    version: "1.0",
    title: "Termos de Uso — Meu Rim",
    body: [
      "1. A Meu Rim é uma plataforma de teleconsulta e acompanhamento em nefrologia que conecta pacientes a médicos com registro ativo no CRM.",
      "2. A plataforma NÃO é serviço de emergência. Em caso de urgência (dor intensa, falta de ar, desmaio, sangramento, ausência de urina), procure atendimento presencial imediato.",
      "3. O paciente é responsável por fornecer informações verdadeiras e atualizadas.",
      "4. O pagamento da consulta libera o acesso à sala de teleconsulta. O valor é destinado ao médico escolhido; a plataforma pode reter taxa de serviço informada no checkout.",
      "5. O médico é responsável pelo ato clínico, pelo sigilo e pelo cumprimento das normas do CFM/CRM.",
      "6. O uso da plataforma implica concordância com estes Termos. O descumprimento pode levar à suspensão do acesso.",
      "7. Este documento pode ser atualizado; novas versões exigirão novo aceite.",
    ].join("\n\n"),
  },
  {
    type: "privacy",
    version: "1.0",
    title: "Política de Privacidade — Meu Rim (LGPD)",
    body: [
      "1. Tratamos dados pessoais e dados de saúde para viabilizar agendamento, pagamento, teleconsulta e acompanhamento clínico, conforme a Lei nº 13.709/2018 (LGPD).",
      "2. Dados coletados podem incluir: nome, e-mail, telefone, CPF, cidade, motivo da consulta, registros clínicos (pressão, glicemia, peso, exames, evoluções) e dados de pagamento.",
      "3. Base legal: execução de contrato, cumprimento de obrigação legal/regulatória e tutela da saúde. Dados de saúde são tratados com sigilo profissional.",
      "4. Compartilhamento: com o médico responsável pela consulta e com operadores necessários ao serviço (pagamento e comunicação), sob obrigação de confidencialidade. Não vendemos dados.",
      "5. Segurança: adotamos criptografia em trânsito, controle de acesso e trilha de auditoria dos aceites e acessos.",
      "6. Direitos do titular: confirmação, acesso, correção, portabilidade, informação sobre compartilhamento e revogação de consentimento, quando aplicável.",
      "7. Retenção: os dados são mantidos pelo prazo legal aplicável a prontuários e registros fiscais.",
      "8. Contato do encarregado/administrador: pelos canais oficiais da plataforma.",
    ].join("\n\n"),
  },
  {
    type: "telehealth",
    version: "1.0",
    title: "Termo de Consentimento para Teleconsulta",
    body: [
      "1. Declaro estar ciente de que a consulta será realizada de forma remota (telemedicina), conforme a Resolução CFM aplicável.",
      "2. Entendo que a teleconsulta possui limitações inerentes à ausência de exame físico presencial e que, se necessário, poderei ser encaminhado para atendimento presencial.",
      "3. Autorizo o registro das informações clínicas no meu prontuário eletrônico.",
      "4. Estou ciente de que a teleconsulta NÃO substitui atendimento de emergência.",
      "5. Comprometo-me a estar em ambiente adequado, com conexão, câmera e microfone, no horário agendado.",
      "6. Consinto, de forma livre e esclarecida, com a realização da teleconsulta na plataforma Meu Rim.",
    ].join("\n\n"),
  },
];

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export type ConsentDocument = DocDef & { sha256: string };

/** Documentos ativos atuais, já com o hash SHA-256 calculado do texto. */
export function currentDocuments(): ConsentDocument[] {
  return DOCS.map((d) => ({ ...d, sha256: sha256(d.body) }));
}

export function currentDocument(type: ConsentType): ConsentDocument | null {
  const d = DOCS.find((x) => x.type === type);
  return d ? { ...d, sha256: sha256(d.body) } : null;
}

/** Analisa o user-agent de forma leve (sem dependências). */
export function parseUserAgent(ua: string): {
  browser: string;
  operatingSystem: string;
  device: string;
} {
  const s = ua || "";
  let browser = "Desconhecido";
  if (/Edg\//.test(s)) browser = "Edge";
  else if (/OPR\//.test(s) || /Opera/.test(s)) browser = "Opera";
  else if (/Chrome\//.test(s)) browser = "Chrome";
  else if (/Firefox\//.test(s)) browser = "Firefox";
  else if (/Safari\//.test(s)) browser = "Safari";

  let operatingSystem = "Desconhecido";
  if (/Windows/.test(s)) operatingSystem = "Windows";
  else if (/iPhone|iPad|iPod/.test(s)) operatingSystem = "iOS";
  else if (/Android/.test(s)) operatingSystem = "Android";
  else if (/Mac OS X|Macintosh/.test(s)) operatingSystem = "macOS";
  else if (/Linux/.test(s)) operatingSystem = "Linux";

  let device = "desktop";
  if (/iPad|Tablet/.test(s)) device = "tablet";
  else if (/Mobi|Android|iPhone/.test(s)) device = "mobile";

  return { browser, operatingSystem, device };
}

export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") || "";
}
