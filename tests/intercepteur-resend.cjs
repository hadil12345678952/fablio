// ---------------------------------------------------------------------------
// AJOUT DE LA REPRODUCTION — DOUBLE DE TEST de l'API Resend (aucun code du
// projet n'est modifié).
//
// Pourquoi : l'environnement d'exécution n'a AUCUN accès réseau vers
// api.resend.com. Sans clé réelle, impossible de prouver que le correctif
// d'envoi de courriel fonctionne… et impossible non plus de vérifier le chemin
// d'échec (403 « adresse de test », 422 expéditeur invalide).
//
// Ce fichier est chargé AVANT le serveur Next :
//   NODE_OPTIONS="--require /chemin/tests/intercepteur-resend.cjs" npx next start …
// Il remplace `globalThis.fetch` uniquement pour l'hôte api.resend.com, redirige
// l'appel vers un serveur HTTP local qui conserve le message reçu, puis renvoie
// la réponse demandée :
//
//   COURRIELS_CAPTURE=/tmp/courriels-captures.jsonl   (fichier des messages reçus)
//   RESEND_SIMULE_STATUT=200                          (200 par défaut ; 403/422/500…)
//   RESEND_SIMULE_CORPS='{"message":"..."}'           (corps de la réponse simulée)
//
// ⚠ Ce n'est PAS un moyen de faire fonctionner l'envoi en production : pour que
// les enseignants reçoivent réellement le lien, il faut une clé Resend valide ET
// un expéditeur sur un domaine vérifié (voir docs/environment-variables.md §4).
// ---------------------------------------------------------------------------

const http = require("node:http");
const fs = require("node:fs");

const CAPTURE = process.env.COURRIELS_CAPTURE || "/tmp/courriels-captures.jsonl";
const STATUT = Number(process.env.RESEND_SIMULE_STATUT || 200);
const CORPS =
  process.env.RESEND_SIMULE_CORPS || JSON.stringify({ id: "simule-0000-1111-2222-333333333333" });

const serveur = http.createServer((req, res) => {
  let corps = "";
  req.on("data", (bloc) => (corps += bloc));
  req.on("end", () => {
    if (req.url?.startsWith("/emails") && req.method === "POST") {
      const entree = {
        recuLe: new Date().toISOString(),
        statutSimule: STATUT,
        idempotence: req.headers["idempotency-key"] ?? null,
        autorisationPresente: Boolean(req.headers.authorization),
        corps: (() => {
          try {
            return JSON.parse(corps);
          } catch {
            return corps;
          }
        })(),
      };
      fs.appendFileSync(CAPTURE, JSON.stringify(entree) + "\n");
      res.writeHead(STATUT, { "Content-Type": "application/json" });
      res.end(CORPS);
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "double de test : route inconnue" }));
  });
});

async function demarrer() {
  await new Promise((r) => serveur.listen(0, "127.0.0.1", r));
  const port = serveur.address().port;
  const cible = `http://127.0.0.1:${port}`;
  const fetchOriginal = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (entree, init) => {
    const url = typeof entree === "string" ? entree : entree.url;
    if (url.startsWith("https://api.resend.com")) {
      return fetchOriginal(cible + url.slice("https://api.resend.com".length), init);
    }
    return fetchOriginal(entree, init);
  };
  console.log(
    `[intercepteur-resend] actif — capture=${CAPTURE} statut simulé=${STATUT} (port ${port})`
  );
}

demarrer().catch((e) => {
  console.error("[intercepteur-resend] démarrage impossible", e);
  process.exit(1);
});
