import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ---------------------------------------------------------------------------
  // En-têtes de sécurité (audit 2026-10).
  //
  // Aucun de ces en-têtes ne change le comportement de l'application : ils
  // ferment des portes qui n'ont pas d'usage ici.
  //   • nosniff            : interdit à l'explorateur de deviner un type (les
  //                          enseignants collent des URL d'images venues d'ailleurs) ;
  //   • Referrer-Policy    : ne fuit pas l'URL complète (contenant des identifiants
  //                          de jeton) vers les tiers intégrés (YouTube, H5P…) ;
  //   • frame-ancestors 'none' + X-Frame-Options DENY : personne n'encadre Fablio
  //                          → bloque le clickjacking. Les intégrations sortantes
  //                          (nous qui encadrons YouTube/H5P) ne sont pas concernées ;
  //   • Permissions-Policy : caméra, micro, géolocalisation, paiement… refusés par
  //                          défaut — la lecture à voix haute n'en a pas besoin
  //                          (elle passe par /api/tts puis Audio(), pas par le micro).
  //
  // VOLONTAIREMENT ABSENTS (à décider par le propriétaire, documenté dans
  // docs/AUDIT-2026-10.md) : une Content-Security-Policy stricte — elle exige des
  // nonces côté serveur et casserait les iframes H5P/YouTube et les styles inline
  // de l'éditeur ; COOP/COEP — ils isolent les contexts et peuvent casser les
  // lecteurs vidéo tiers.
  // ---------------------------------------------------------------------------
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
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
