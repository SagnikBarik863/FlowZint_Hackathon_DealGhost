import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit uses __dirname to locate its font files at runtime.
  // If webpack bundles it, __dirname resolves to a fake path and the fonts
  // are not found. Marking it as external forces Node.js to require() it
  // directly, keeping the real node_modules path intact.
  serverExternalPackages: ['pdfkit'],
  // Hide the Next.js dev indicator badge (the "N" overlay in the corner)
  devIndicators: false,
};

export default nextConfig;
