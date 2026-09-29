import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["xlsx", "unpdf", "tesseract.js"],
};

export default nextConfig;
