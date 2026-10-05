import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Photo uploads go through a Server Action; the 1 MB default is too small.
    // The browser downscales photos first and the action caps them at 4 MB.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
