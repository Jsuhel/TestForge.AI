import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Load these Node-only libraries from node_modules at runtime instead of
  // bundling them (unpdf, mammoth fs access and playwright's browser
  // launcher all break when bundled).
  serverExternalPackages: ["unpdf", "mammoth", "playwright"],
  // Hide the Next.js dev-tools bubble in the corner — the app shows its own
  // brand floating action button instead.
  devIndicators: false,
};

export default nextConfig;
