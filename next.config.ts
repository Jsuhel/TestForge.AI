import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Load these Node-only libraries from node_modules at runtime instead of
  // bundling them (unpdf, mammoth fs access and playwright's browser
  // launcher all break when bundled).
  serverExternalPackages: ["unpdf", "mammoth", "playwright"],
};

export default nextConfig;
