/** Contato oficial da Meu Rim. Trocar aqui reflete em todos os botões de WhatsApp. */
export const WHATSAPP_NUMBER = "5573999052933"; // (73) 99905-2933

/** Monta o link de conversa no WhatsApp já com a mensagem pré-preenchida. */
export function whatsappLink(text: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
