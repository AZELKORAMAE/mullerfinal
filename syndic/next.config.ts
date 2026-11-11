import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  experimental: {
    // Transfer screenshots (max 5 MB) are uploaded through a Server Action.
    serverActions: { bodySizeLimit: "6mb" },
  },
};
export default nextConfig;
