import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Üst dizinlerdeki başka lockfile'lar yüzünden kökün yanlış algılanmasını önler
  turbopack: { root: process.cwd() },
};

export default nextConfig;
