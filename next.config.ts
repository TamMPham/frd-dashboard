import type { NextConfig } from "next";

// The browser always calls same-origin /api/* — in dev Next proxies it to the
// FastAPI backend here; in production Caddy does the same path routing. No
// CORS anywhere.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
