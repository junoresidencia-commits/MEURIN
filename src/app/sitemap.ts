import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const paths = [
    "",
    "/agendar",
    "/educacao",
    "/medicos/cadastro",
    "/medicos/login",
    "/amanha",
    "/minhas-consultas",
    "/termos",
    "/privacidade",
    "/instalar",
  ];
  const now = new Date();
  return paths.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "" || path === "/agendar" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
