import { NextResponse, type NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// CONTRÔLE D'ORIGINE sur les requêtes qui MODIFIENT l'état (CSRF).
//
// Contexte d'audit : l'application s'appuie sur un cookie de session `httpOnly`
// avec `sameSite: "lax"`, ce qui bloque déjà les POST inter-sites déclenchés par
// un formulaire HTML. Il restait deux trouées :
//   • un cookie `lax` EST envoyé pour les navigations « top-level » GET
//     entrantes — inoffensif ici (nos routes qui écrivent sont en POST/PUT/
//     PATCH/DELETE), mais une future route GET destructive serait exposée ;
//   • aucune défense si `sameSite` changeait de valeur, ou devant un proxy qui
//     réécrit les règles de cadrage.
//
// Le contrôle d'origine est la défense standard en profondeur : pour toute
// requête mutante sur /api/**, SI l'explorateur a envoyé un en-tête `Origin`,
// alors cet `Origin` doit désigner le même hôte que la requête. Sinon → 403.
//
// Choix volontaires :
//   • les requêtes SANS `Origin` sont acceptées : curl, applications natives,
//     et surtout les clients qui n'envoient pas l'en-tête pour une requête
//     same-origin simple — refuser casserait des intégrations licites ;
//   • seules les méthodes mutantes sont contrôlées (GET/HEAD ne changent rien) ;
//   • le périmètre est `/api/*` uniquement : les pages restent servies normalement ;
//   • le comparateur accepte la variante « même hôte, port implicite » (un
//     déploiement derrière un proxy TLS peut renvoyer `Host:exemple.tnsansport`
//     alors que `Origin` est `https://exemple.tn`) : on ne compare que le NOM
//     D'HÔTE, jamais le protocole ni le port.
// ---------------------------------------------------------------------------

const METHODES_MUTANTES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Hôte nu, sans port : `a.tn:443` → `a.tn`, `a.tn` → `a.tn`. */
function hoteNu(valeur: string | null): string {
  if (!valeur) return "";
  const brut = valeur.trim().toLowerCase();
  try {
    const url = new URL(/^https?:\/\//.test(brut) ? brut : `http://${brut}`);
    return url.hostname;
  } catch {
    return brut.replace(/^https?:\/\//, "").split(":")[0].split("/")[0];
  }
}

export function middleware(req: NextRequest) {
  if (!METHODES_MUTANTES.has(req.method.toUpperCase())) {
    return NextResponse.next();
  }

  const enteteOrigin = req.headers.get("origin");
  if (!enteteOrigin) return NextResponse.next(); // client n'envoyant pas Origin

  // Derrière Vercel, `host` peut être l'hôte interne du runtime : la source de
  // vérité publique est `x-forwarded-host` (que la plateforme impose).
  const hoteAttendu =
    hoteNu(req.headers.get("x-forwarded-host")) ||
    hoteNu(req.headers.get("host")) ||
    hoteNu(req.nextUrl.hostname);

  if (hoteNu(enteteOrigin) === hoteAttendu) return NextResponse.next();

  return NextResponse.json(
    {
      erreur:
        "Origine de la requête non reconnue : la modification a été refusée (protection CSRF).",
    },
    {
      status: 403,
      headers: { "X-Content-Type-Options": "nosniff" },
    }
  );
}

export const config = {
  // Une seule règle : tout /api/** (les segments dynamiques sont inclus).
  matcher: "/api/:path*",
};
