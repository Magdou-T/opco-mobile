import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Export 100 % statique : le dossier `out/` se depose tel quel
  // sur un hebergement mutualise (Hostinger, Apache, Nginx).
  output: "export",
  // Chaque page devient un dossier avec index.html : URLs propres sur Apache.
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    // Monorepo (npm workspaces) : les dependances sont hissees a la racine
    // du depot et @opco/core vit dans packages/core, hors de apps/web.
    root: path.resolve(__dirname, "../.."),
  },
  // @opco/core est du TypeScript brut (main/types pointent vers src/index.ts).
  transpilePackages: ["@opco/core"],
};

export default nextConfig;
