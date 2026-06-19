import type { NextConfig } from "next";

const backendApiUrl = (process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.1.5"],
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: `${backendApiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
