import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // pdfjs-dist deve ser carregado em runtime (Node), não empacotado pelo bundler.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
