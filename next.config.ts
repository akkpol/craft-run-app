import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is default in Next.js 16, no flag needed
  turbopack: {
    root: __dirname,
  },
  reactCompiler: true,
};

export default nextConfig;
