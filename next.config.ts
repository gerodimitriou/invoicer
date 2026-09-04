import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next drops agent instruction files into the project root by default.
  // They are editor tooling, not part of the app.
  agentRules: false,
};

export default nextConfig;
