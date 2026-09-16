/** Links oficiais para assinar PDF com certificado ICP-Brasil (VIDaaS / gov.br / CFM).
 *  Não inventa integração de API: assinar dentro do Meu Rim exige contrato com a Valid.
 *  Enquanto isso, o médico baixa o PDF e assina no app VIDaaS, no Connect ou no Assinador gov.br.
 *  Fonte única — o catálogo DigitalSignatureProvider reexporta estes endereços. */

export const SIGNATURE_LINKS = {
  vidaasInfo: "https://validcertificadora.com.br/pages/certificado-em-nuvem",
  vidaasAndroid: "https://play.google.com/store/apps/details?id=br.com.valid.vidaas",
  vidaasIos: "https://apps.apple.com/br/app/vidaas/id1490636157",
  govAssinador: "https://assinador.iti.br/",
  validarIti: "https://validar.iti.gov.br/",
  cfmCertificado: "https://certificadodigital.cfm.org.br/",
  cfmPortalServicos: "https://portalservicos.cfm.org.br/",
  cfmPrescricao: "https://prescricaoeletronica.cfm.org.br/",
  cfmEcrm: "https://ecrm.cfm.org.br/",
} as const;

export const VIDAAS_PREF_KEY = "meurim.sign.vidaas";
