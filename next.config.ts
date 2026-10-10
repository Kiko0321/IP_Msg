import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle for the production Docker image later.
  output: "standalone",
};

export default nextConfig;
