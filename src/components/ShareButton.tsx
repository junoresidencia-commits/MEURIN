"use client";

type Props = {
  title?: string;
  text?: string;
  className?: string;
};

const DEFAULT_TEXT =
  "Meu Rim — consulta online com nefrologista, de qualquer cidade. Sem deslocamento, sem Zoom pago. Agende aqui:";

export function ShareButton({
  title = "Meu Rim — nefrologia online",
  text = DEFAULT_TEXT,
  className = "btn-gold",
}: Props) {
  async function share() {
    const url =
      typeof window !== "undefined" ? window.location.origin : "https://meurim.app";
    const full = `${text} ${url}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        /* user cancelled or unsupported — fall through */
      }
    }

    const wa = `https://wa.me/?text=${encodeURIComponent(full)}`;
    window.open(wa, "_blank", "noopener,noreferrer");
  }

  return (
    <button type="button" className={className} onClick={share}>
      Compartilhar no WhatsApp
    </button>
  );
}
