import type { NextConfig } from "next";

// The browser calls /api/* on this same site and Next.js forwards it to the Python backend,
// so only one port needs to be open (handy on Codespaces and when hosting).
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
