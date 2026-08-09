"use client";

import { useEffect } from "react";

/** Registra o service worker do PWA (uma vez, após carregar). Silencioso em navegadores sem suporte. */
export function PwaBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sem SW o app continua funcionando (apenas sem push/offline). Não quebrar.
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
