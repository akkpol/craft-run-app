import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is default in Next.js 16, no flag needed
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "account-center-fe.line-scdn.net",
        pathname: "/images/**",
      },
    ],
  },
  reactCompiler: true,
};

export default nextConfig;
