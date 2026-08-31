import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Les enseignants collent des URL d'illustrations venant de n'importe quelle
    // source (Google Drive, Wikimedia, banque d'images de l'école…). On autorise
    // donc les images distantes en HTTP(S) ; elles restent optimisées par Next.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
    // Si l'optimiseur échoue (hôte lent, format exotique), on sert l'original
    // plutôt que d'afficher une image cassée.
    dangerouslyAllowSVG: false,
    contentDispositionType: "inline",
  },
};

export default nextConfig;
