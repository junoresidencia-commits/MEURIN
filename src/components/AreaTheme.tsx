"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Aplica a identidade de cor por perfil (só acentos) via data-area no <html>.
// Médico = petróleo/teal escuro · Nutricionista = verde · Atendente = roxo ·
// Paciente/site = teal padrão. NÃO altera funções — apenas a paleta de acento.
export function AreaTheme() {
  const pathname = usePathname() || "";
  useEffect(() => {
    let area = "";
    if (pathname.startsWith("/nutricionista")) area = "nutri";
    else if (pathname.startsWith("/psicologo")) area = "psico";
    else if (pathname.startsWith("/enfermeiro")) area = "enfermagem";
    else if (pathname.startsWith("/atendente")) area = "atendente";
    else if (pathname.startsWith("/medicos")) area = "medico";
    const root = document.documentElement;
    if (area) root.setAttribute("data-area", area);
    else root.removeAttribute("data-area");
    return () => { /* mantém até a próxima navegação decidir */ };
  }, [pathname]);
  return null;
}
