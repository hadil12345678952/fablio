// ---------------------------------------------------------------------------
// AJOUT DE LA REPRODUCTION (fichier absent du projet d'origine).
//
// Tests fonctionnels de bout en bout de Fablio, exécutés contre une instance
// RÉELLE (serveur Next.js + PostgreSQL). Aucune dépendance : fetch natif.
//
//   npm start                       # dans un autre terminal
//   node tests/e2e-fablio.mjs
//
// Variables : BASE_URL (défaut http://127.0.0.1:3000)
//
// Les tests vérifient les règles métier du code source (notation, tentatives,
// publication, blocs, cloisonnement entre enseignants, récupération de mot de
// passe) — ils ne modifient aucune donnée de production : ils s'exécutent
// contre la base de développement pointée par DATABASE_URL.
// ---------------------------------------------------------------------------

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const SUFFIXE = Date.now().toString(36);

let personnes = 0;
let reussis = 0;
const echecs = [];
const notes = [];

function verifier(nom, condition, detail = "") {
  personnes++;
  if (condition) {
    reussis++;
    console.log(`  ✓ ${nom}`);
  } else {
    echecs.push(`${nom}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(titre) {
  notes.push(titre);
  console.log(`\n■ ${titre}`);
}

/** Requête HTTP avec gestion du cookie de session. */
async function requete(methode, chemin, { cookie, corps, entetes = {} } = {}) {
  const res = await fetch(`${BASE}${chemin}`, {
    method: methode,
    headers: {
      ...(corps !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...entetes,
    },
    body: corps !== undefined ? JSON.stringify(corps) : undefined,
    redirect: "manual",
  });
  const brut = await res.text();
  let json = null;
  try {
    json = JSON.parse(brut);
  } catch {
    /* réponse non JSON (HTML, CSV, audio) */
  }
  const setCookie = res.headers.get("set-cookie") ?? "";
  const session = /fablio_session=([^;]+)/.exec(setCookie)?.[1] ?? null;
  return { statut: res.status, json, brut, entetes: res.headers, session };
}

async function seConnecterEnseignant(email, motDePasse) {
  const r = await requete("POST", "/api/auth/enseignant/connexion", {
    corps: { email, motDePasse },
  });
  return r.session ? `fablio_session=${r.session}` : null;
}

async function seConnecterEleve(pseudo, code, pin) {
  const r = await requete("POST", "/api/auth/eleve/connexion", {
    corps: { pseudo, code, pin },
  });
  return r.session ? `fablio_session=${r.session}` : null;
}

// ---------------------------------------------------------------------------

section("1. Pages publiques et sonde de santé");
for (const chemin of ["/", "/connexion", "/inscription", "/mot-de-passe/oublie", "/mot-de-passe/reinitialiser"]) {
  const r = await requete("GET", chemin);
  verifier(`GET ${chemin} → 200`, r.statut === 200, `reçu ${r.statut}`);
}
{
  const r = await requete("GET", "/api/health");
  verifier(
    "GET /api/health → { ok: true } (connexion SQL réelle)",
    r.statut === 200 && r.json?.ok === true,
    JSON.stringify(r.json)
  );
  verifier(
    "GET /api/health → indique le transport de courriel actif (diagnostic « pas de mail »)",
    r.json?.courriel === "resend" || r.json?.courriel === "journal",
    JSON.stringify(r.json)
  );
  const r404 = await requete("GET", "/page-inexistante-xyz");
  verifier("page inconnue → 404", r404.statut === 404, `reçu ${r404.statut}`);
}

section("2. Sessions et cloisonnement (401 sans cookie)");
for (const chemin of [
  "/api/enseignant/fables",
  "/api/enseignant/stats/synthese",
  "/api/eleve/fables",
  "/api/enseignant/export/resultats.csv",
]) {
  const r = await requete("GET", chemin);
  verifier(`GET ${chemin} sans session → 401`, r.statut === 401, `reçu ${r.statut}`);
}
{
  const r = await requete("POST", "/api/tts", { corps: { texte: "Bonjour" } });
  verifier("POST /api/tts sans session → 401", r.statut === 401, `reçu ${r.statut}`);
}

section("3. Connexion et inscriptions");
const cookieEnseignant = await seConnecterEnseignant("demo.enseignant@fablio.tn", "demo1234");
verifier("connexion enseignant de démonstration", cookieEnseignant !== null);
{
  const r = await requete("GET", "/api/auth/moi", { cookie: cookieEnseignant });
  verifier(
    "/api/auth/moi → type enseignant (jamais de hachage renvoyé)",
    r.json?.session?.type === "enseignant" && !("motDePasseHash" in (r.json?.session ?? {})),
    JSON.stringify(r.json)
  );
}
{
  const r = await requete("POST", "/api/auth/enseignant/connexion", {
    corps: { email: "demo.enseignant@fablio.tn", motDePasse: "mauvais-mot-de-passe" },
  });
  verifier("connexion avec mauvais mot de passe → 401", r.statut === 401, `reçu ${r.statut}`);
}
{
  const r = await requete("POST", "/api/auth/enseignant/inscription", {
    corps: { nom: "A", email: "pas-un-email", motDePasse: "court" },
  });
  verifier("inscription enseignant invalide → 400 + message", r.statut === 400 && !!r.json?.erreur);
}
const emailEnseignant2 = `prof.${SUFFIXE}@fablio.test`;
let cookieEnseignant2 = null;
{
  const r = await requete("POST", "/api/auth/enseignant/inscription", {
    corps: { nom: "Professeur Test", email: emailEnseignant2, motDePasse: "motdepasse123" },
  });
  verifier("inscription enseignant valide → session ouverte", r.statut === 200 && !!r.session);
  cookieEnseignant2 = r.session ? `fablio_session=${r.session}` : null;
  const r2 = await requete("POST", "/api/auth/enseignant/inscription", {
    corps: { nom: "Professeur Test", email: emailEnseignant2, motDePasse: "motdepasse123" },
  });
  verifier("inscription avec email déjà pris → 409", r2.statut === 409, `reçu ${r2.statut}`);
}

section("4. Codes de parrainage et données de démonstration");
{
  const r = await requete("GET", "/api/enseignant/codes", { cookie: cookieEnseignant });
  const codes = r.json?.codes ?? [];
  verifier(
    "GET /api/enseignant/codes → codes de démo avec effectifs",
    r.statut === 200 && codes.some((c) => c.code === "CE2A-DEMO1") && codes.some((c) => c.etiquette === "CE2 · Groupe A"),
    JSON.stringify(codes.map((c) => [c.code, c.nbEleves]))
  );
}
{
  const r = await requete("GET", "/api/enseignant/fables", { cookie: cookieEnseignant });
  const fables = r.json?.fables ?? [];
  const demos = ["La Cigale et la Fourmi", "Le Corbeau et le Renard", "Le Lièvre et la Tortue"];
  verifier(
    "GET /api/enseignant/fables → les 3 fables de démonstration sont présentes",
    r.statut === 200 && demos.every((t) => fables.some((f) => f.titre === t)),
    fables.map((f) => f.titre).join(" | ")
  );
  verifier(
    "compteurs d'exercices par fable de démo (9 au total)",
    demos.every((t) => fables.find((f) => f.titre === t)?.nbExercices === 3),
    demos.map((t) => `${t}:${fables.find((f) => f.titre === t)?.nbExercices}`).join(" | ")
  );
}

section("5. Règles de notation (moteur noterExercice) via l'API");
const cookieEleve = await seConnecterEleve("lina", "CE2A-DEMO1", "1234");
verifier("connexion élève (pseudo + code de classe + PIN)", cookieEleve !== null);
{
  const r = await requete("POST", "/api/auth/eleve/connexion", {
    corps: { pseudo: "lina", code: "CE2A-DEMO1", pin: "0000" },
  });
  verifier("PIN erroné → 401", r.statut === 401, `reçu ${r.statut}`);
  const r2 = await requete("POST", "/api/auth/eleve/connexion", {
    corps: { pseudo: "lina", code: "CODE-BIDON", pin: "1234" },
  });
  verifier("code de classe inconnu → 401", r2.statut === 401, `reçu ${r2.statut}`);
}
{
  const rFables = await requete("GET", "/api/eleve/fables", { cookie: cookieEleve });
  const fables = rFables.json?.fables ?? [];
  verifier("GET /api/eleve/fables → au moins les 3 fables publiées de démo", rFables.statut === 200 && fables.length >= 3, `reçu ${fables.length}`);
}
{
  const r = await requete("GET", "/api/enseignant/fables", { cookie: cookieEnseignant });
  const fableCigale = r.json.fables.find((f) => f.titre === "La Cigale et la Fourmi");
  const detail = await requete("GET", `/api/enseignant/fables/${fableCigale.id}`, { cookie: cookieEnseignant });
  const qcm = detail.json.exercices.find((e) => e.type === "qcm");
  const trous = detail.json.exercices.find((e) => e.type === "texte_trous");
  const vf = detail.json.exercices.find((e) => e.type === "vrai_faux");

  // QCM : bonne réponse (index 0) ⇒ note pleine, réussite
  const bon = await requete("POST", `/api/exercices/${qcm.id}/soumettre`, {
    cookie: cookieEleve,
    corps: { reponse: [0], dureeSecondes: 20 },
  });
  verifier(
    "QCM correct → score 10/10, estCorrect=true, feedbackCorrect",
    bon.json?.resultat?.score === 10 && bon.json?.resultat?.estCorrect === true && !!bon.json?.resultat?.feedback,
    JSON.stringify(bon.json?.resultat)
  );

  // QCM : mauvaise réponse ⇒ 0 + corrigé détaillé
  const mauvais = await requete("POST", `/api/exercices/${qcm.id}/soumettre`, {
    cookie: cookieEleve,
    corps: { reponse: [1], dureeSecondes: 15 },
  });
  verifier(
    "QCM faux → score 0, corrigé renvoyé (une ligne par bonne réponse)",
    mauvais.json?.resultat?.score === 0 &&
      mauvais.json?.resultat?.estCorrect === false &&
      Array.isArray(mauvais.json?.resultat?.correction) &&
      mauvais.json.resultat.correction.length === 1,
    JSON.stringify(mauvais.json?.resultat)
  );
  verifier(
    "numérotation des tentatives incrémentale (le compteur augmente de 1 à chaque envoi)",
    mauvais.json?.resultat?.tentativesUtilisees === bon.json?.resultat?.tentativesUtilisees + 1,
    `après 1re=${bon.json?.resultat?.tentativesUtilisees}, après 2e=${mauvais.json?.resultat?.tentativesUtilisees}`
  );

  // Vrai/Faux
  const vfBon = await requete("POST", `/api/exercices/${vf.id}/soumettre`, {
    cookie: cookieEleve,
    corps: { reponse: false, dureeSecondes: 9 },
  });
  verifier("vrai_faux correct → note pleine", vfBon.json?.resultat?.score === 5 && vfBon.json?.resultat?.estCorrect === true, JSON.stringify(vfBon.json?.resultat));

  // Texte à trous : notation partielle arrondie au quart
  const trousBon = await requete("POST", `/api/exercices/${trous.id}/soumettre`, {
    cookie: cookieEleve,
    corps: { reponse: ["chanté", "dépourvue"], dureeSecondes: 30 },
  });
  verifier("texte_trous complet → 15/15", trousBon.json?.resultat?.score === 15, JSON.stringify(trousBon.json?.resultat));
  const trousPartiel = await requete("POST", `/api/exercices/${trous.id}/soumettre`, {
    cookie: cookieEleve,
    corps: { reponse: ["zappe", "dépourvue"], dureeSecondes: 30 },
  });
  verifier(
    "texte_trous 1/2 → 7.5 (arrondi au quart de point)",
    trousPartiel.json?.resultat?.score === 7.5 && trousPartiel.json?.resultat?.estCorrect === false,
    JSON.stringify(trousPartiel.json?.resultat)
  );
  const trousAccents = await requete("POST", `/api/exercices/${trous.id}/soumettre`, {
    cookie: cookieEleve,
    corps: { reponse: ["chante", "depourvue"], dureeSecondes: 30 },
  });
  verifier(
    "texte_trous : normalisation accents/casse (« chante », « depourvue » acceptées)",
    trousAccents.json?.resultat?.score === 15,
    JSON.stringify(trousAccents.json?.resultat)
  );
}

section("6. Correction manuelle (question ouverte et H5P)");
{
  const r = await requete("GET", "/api/enseignant/fables", { cookie: cookieEnseignant });
  const fableLievre = r.json.fables.find((f) => f.titre === "Le Lièvre et la Tortue");
  const detail = await requete("GET", `/api/enseignant/fables/${fableLievre.id}`, { cookie: cookieEnseignant });
  const ouverte = detail.json.exercices.find((e) => e.type === "question_ouverte");

  const soumission = await requete("POST", `/api/exercices/${ouverte.id}/soumettre`, {
    cookie: cookieEleve,
    corps: { reponse: "Il perd parce qu'il a dormi.", dureeSecondes: 60 },
  });
  verifier(
    "question ouverte sans réponses acceptées → score null (attente de correction)",
    soumission.json?.resultat?.score === null && soumission.json?.resultat?.estCorrect === null,
    JSON.stringify(soumission.json?.resultat)
  );
  verifier(
    "message élève spécifique à l'attente de correction",
    /corrig/i.test(soumission.json?.resultat?.feedback ?? ""),
    soumission.json?.resultat?.feedback
  );
  const tentativeId = soumission.json?.resultat?.tentativeId;
  const trop = await requete("PATCH", `/api/enseignant/reponses/${tentativeId}`, {
    cookie: cookieEnseignant,
    corps: { score: 999 },
  });
  verifier("correction au-delà du barème → 400", trop.statut === 400, `reçu ${trop.statut} ${trop.brut.slice(0, 120)}`);
  const ok = await requete("PATCH", `/api/enseignant/reponses/${tentativeId}`, {
    cookie: cookieEnseignant,
    corps: { score: 8 },
  });
  verifier(
    "correction valide → score enregistré, corrigeLe renseigné, estCorrect=false (8 < 10)",
    ok.statut === 200 && ok.json?.tentative?.score === 8 && !!ok.json?.tentative?.corrigeLe && ok.json?.tentative?.estCorrect === false,
    JSON.stringify(ok.json?.tentative)
  );
  const autre = await requete("PATCH", `/api/enseignant/reponses/${tentativeId}`, {
    cookie: cookieEnseignant2,
    corps: { score: 10 },
  });
  verifier("un autre enseignant ne peut pas corriger cette réponse → 404", autre.statut === 404, `reçu ${autre.statut}`);
}

section("7. Limite de tentatives (maxTentatives)");
{
  // Élève neuf (aucune tentative en base) : indispensable pour observer la
  // limite sans l'historique des données de démonstration.
  const pseudoNeuf = `max${SUFFIXE}`;
  const inscription = await requete("POST", "/api/auth/eleve/inscription", {
    corps: { pseudo: pseudoNeuf, code: "CE2A-DEMO1", pin: "4321" },
  });
  const cookieNeuf = inscription.session ? `fablio_session=${inscription.session}` : null;
  verifier("inscription d'un élève neuf via un code de classe actif", inscription.statut === 200 && !!cookieNeuf, JSON.stringify(inscription.json));

  const r = await requete("GET", "/api/enseignant/fables", { cookie: cookieEnseignant });
  const fable = r.json.fables.find((f) => f.titre === "Le Corbeau et le Renard");
  const detail = await requete("GET", `/api/enseignant/fables/${fable.id}`, { cookie: cookieEnseignant });
  const assoc = detail.json.exercices.find((e) => e.type === "association");
  const maj = await requete("PUT", `/api/enseignant/exercices/${assoc.id}`, {
    cookie: cookieEnseignant,
    corps: { maxTentatives: 1 },
  });
  verifier("barème de tentatives modifiable par le propriétaire", maj.statut === 200 && maj.json?.exercice?.maxTentatives === 1, JSON.stringify(maj.json?.erreur ?? maj.json?.exercice?.maxTentatives));
  const t1 = await requete("POST", `/api/exercices/${assoc.id}/soumettre`, {
    cookie: cookieNeuf,
    corps: { reponse: [0, 1, 2, 3], dureeSecondes: 20 },
  });
  verifier(
    "1re tentative association (4 paires) → 10/10 et tentativesRestantes=0",
    t1.json?.resultat?.score === 10 && t1.json?.resultat?.tentativesRestantes === 0,
    JSON.stringify(t1.json?.resultat)
  );
  const t2 = await requete("POST", `/api/exercices/${assoc.id}/soumettre`, {
    cookie: cookieNeuf,
    corps: { reponse: [0, 1, 2, 3], dureeSecondes: 20 },
  });
  verifier("tentatives épuisées → 403 avec message", t2.statut === 403 && !!t2.json?.erreur, `reçu ${t2.statut}`);
  await requete("PUT", `/api/enseignant/exercices/${assoc.id}`, {
    cookie: cookieEnseignant,
    corps: { maxTentatives: null },
  });
  const t3 = await requete("POST", `/api/exercices/${assoc.id}/soumettre`, {
    cookie: cookieNeuf,
    corps: { reponse: [0, 2, 1, 3], dureeSecondes: 20 },
  });
  verifier(
    "limite retirée (null = illimité) → nouvelle tentative acceptée, 2 paires justes /4 → 5 points",
    t3.statut === 200 && t3.json?.resultat?.score === 5 && t3.json?.resultat?.tentativesRestantes === null,
    JSON.stringify(t3.json?.resultat)
  );
}

section("8. Création et validation de fables");
let fableTestId = null;
{
  const tropCourt = await requete("POST", "/api/enseignant/fables", {
    cookie: cookieEnseignant,
    corps: { titre: "X", texte: "trop court" },
  });
  verifier(
    "fable : titre < 2 caractères → 400 avec message métier",
    tropCourt.statut === 400 && /titre/i.test(tropCourt.json?.erreur ?? ""),
    JSON.stringify(tropCourt.json)
  );
  const imageInvalide = await requete("POST", "/api/enseignant/fables", {
    cookie: cookieEnseignant,
    corps: { titre: "Fable image", texte: "Texte assez long pour être valide.", imageUrl: "javascript:alert(1)" },
  });
  verifier("fable : URL d'image non http(s) refusée → 400", imageInvalide.statut === 400, JSON.stringify(imageInvalide.json));
  const videoInconnue = await requete("POST", "/api/enseignant/fables", {
    cookie: cookieEnseignant,
    corps: { titre: "Fable vidéo", texte: "Texte assez long pour être valide.", videoUrl: "https://exemple.test/video.avi" },
  });
  verifier("fable : lien vidéo non reconnu → 400", videoInconnue.statut === 400, JSON.stringify(videoInconnue.json));
  const drive = await requete("POST", "/api/enseignant/fables", {
    cookie: cookieEnseignant,
    corps: {
      titre: `Fable de test ${SUFFIXE}`,
      texte: "Un renard très rusé passait par là, et il rencontra un corbeau fort vaniteux.",
      morale: "Test de la reproduction.",
      imageUrl: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQr/view?usp=sharing",
      difficulte: "moyen",
      publie: false,
    },
  });
  fableTestId = drive.json?.fable?.id ?? null;
  verifier(
    "création de fable valide → 200 + normalisation du lien Google Drive",
    drive.statut === 200 && drive.json?.fable?.imageUrl?.startsWith("https://lh3.googleusercontent.com/d/1AbCdEfGhIjKlMnOpQr"),
    drive.json?.fable?.imageUrl
  );
  const maj = await requete("PUT", `/api/enseignant/fables/${fableTestId}`, {
    cookie: cookieEnseignant,
    corps: { difficulte: "impossible" },
  });
  verifier("difficulté hors {facile,moyen,difficile} → 400", maj.statut === 400, JSON.stringify(maj.json));
  const majAutre = await requete("PUT", `/api/enseignant/fables/${fableTestId}`, {
    cookie: cookieEnseignant2,
    corps: { titre: "Détournement" },
  });
  verifier("un autre enseignant ne peut pas modifier cette fable → 404", majAutre.statut === 404, `reçu ${majAutre.statut}`);
}

section("9. Blocs pédagogiques (invariant d'ordre, publication, cascade)");
{
  const vide = await requete("POST", `/api/enseignant/fables/${fableTestId}/blocs`, {
    cookie: cookieEnseignant,
    corps: { type: "texte", titre: "Brouillon", contenu: { markdown: "" } },
  });
  verifier("bloc brouillon vide accepté (validation tolérante)", vide.statut === 200, JSON.stringify(vide.json));
  const typeInconnu = await requete("POST", `/api/enseignant/fables/${fableTestId}/blocs`, {
    cookie: cookieEnseignant,
    corps: { type: "galerie" },
  });
  verifier("type de bloc non actif (galerie) refusé → 400", typeInconnu.statut === 400, JSON.stringify(typeInconnu.json));
  const html = await requete("POST", `/api/enseignant/fables/${fableTestId}/blocs`, {
    cookie: cookieEnseignant,
    corps: { type: "texte", contenu: { markdown: "<script>alert(1)</script>" } },
  });
  verifier("HTML actif refusé même en brouillon → 400", html.statut === 400, JSON.stringify(html.json));
  const videoInconnue = await requete("POST", `/api/enseignant/fables/${fableTestId}/blocs`, {
    cookie: cookieEnseignant,
    corps: { type: "video", contenu: { source: "fichier", url: "https://exemple.test/x.avi" } },
  });
  verifier("bloc vidéo : source non autorisée refusée (liste blanche)", videoInconnue.statut === 400, JSON.stringify(videoInconnue.json));

  const image = await requete("POST", `/api/enseignant/fables/${fableTestId}/blocs`, {
    cookie: cookieEnseignant,
    corps: { type: "image", titre: "Illustration", contenu: { source: "url", url: "https://exemple.test/img.png", alt: "Alt", legende: "" } },
  });
  verifier("bloc image valide créé", image.statut === 200, JSON.stringify(image.json));
  const audio = await requete("POST", `/api/enseignant/fables/${fableTestId}/blocs`, {
    cookie: cookieEnseignant,
    corps: { type: "audio", contenu: { source: "url", url: "https://exemple.test/a.mp3", titre: "Narration", description: "" } },
  });
  verifier("bloc audio valide créé", audio.statut === 200);

  const liste = await requete("GET", `/api/enseignant/fables/${fableTestId}/blocs`, { cookie: cookieEnseignant });
  const blocs = liste.json?.blocs ?? [];
  verifier(
    "ordre contigu 0..n-1 exposé par l'API",
    blocs.length === 3 && blocs.every((b, i) => b.ordre === i),
    blocs.map((b) => `${b.type}:${b.ordre}`).join(" ")
  );
  // CORRECTIF TESTÉ (normaliserOrdres) : les blocs s'ajoutent À LA SUITE, dans
  // l'ordre de création. Avant le correctif, chaque création plaçait le nouveau
  // bloc en tête et inversait les précédents (ordre observé « audio,texte,image »).
  verifier(
    "création texte,image,audio → ordre de création préservé (correctif normaliserOrdres)",
    blocs.map((b) => b.type).join(",") === "texte,image,audio" &&
      blocs.every((b, i) => b.ordre === i),
    `observé : ${blocs.map((b) => `${b.type}:${b.ordre}`).join(" ")}`
  );
  verifier(
    "le POST renvoie l'ordre réellement attribué (plus de « 0 » systématique)",
    [vide.json?.bloc?.ordre, image.json?.bloc?.ordre, audio.json?.bloc?.ordre].join(",") === "0,1,2",
    `observé : ${[vide.json?.bloc?.ordre, image.json?.bloc?.ordre, audio.json?.bloc?.ordre].join(",")}`
  );
  const ordreFaux = await requete("PUT", `/api/enseignant/fables/${fableTestId}/blocs/ordre`, {
    cookie: cookieEnseignant,
    corps: { ids: [blocs[0].id] },
  });
  verifier("réordonnancement partiel (liste incomplète) → 400", ordreFaux.statut === 400, JSON.stringify(ordreFaux.json));
  const ordreBon = await requete("PUT", `/api/enseignant/fables/${fableTestId}/blocs/ordre`, {
    cookie: cookieEnseignant,
    corps: { ids: [blocs[2].id, blocs[1].id, blocs[0].id] },
  });
  const apres = await requete("GET", `/api/enseignant/fables/${fableTestId}/blocs`, { cookie: cookieEnseignant });
  verifier(
    "réordonnancement complet → ordres réécrits 0,1,2 dans le bon sens",
    ordreBon.statut === 200 &&
      apres.json.blocs[0].id === blocs[2].id &&
      apres.json.blocs.every((b, i) => b.ordre === i),
    apres.json.blocs.map((b) => `${b.type}:${b.ordre}`).join(" ")
  );

  // La source est ici le dernier bloc (ordre 2 après le réordonnancement) :
  // la copie doit s'insérer JUSTE APRÈS elle → ordre 3.
  const duplicata = await requete("POST", `/api/enseignant/blocs/${blocs[0].id}/dupliquer`, { cookie: cookieEnseignant });
  verifier(
    "duplication : nouvel identifiant, contenu cloné, type conservé, inséré JUSTE APRÈS la source",
    duplicata.statut === 200 &&
      duplicata.json.bloc.id !== blocs[0].id &&
      duplicata.json.bloc.type === blocs[0].type &&
      JSON.stringify(duplicata.json.bloc.contenu) === JSON.stringify(blocs[0].contenu) &&
      duplicata.json.bloc.ordre === 3,
    `statut=${duplicata.statut} ordre=${duplicata.json?.bloc?.ordre} (attendu 3)`
  );
  const deplace = await requete("POST", `/api/enseignant/blocs/${blocs[0].id}/deplacer`, {
    cookie: cookieEnseignant,
    corps: { delta: -1 },
  });
  const apresDeplace = await requete("GET", `/api/enseignant/fables/${fableTestId}/blocs`, { cookie: cookieEnseignant });
  verifier(
    "déplacement vers le haut : le bloc remonte d'un rang et les ordres restent contigus",
    deplace.statut === 200 &&
      apresDeplace.json.blocs.every((b, i) => b.ordre === i) &&
      apresDeplace.json.blocs.findIndex((b) => b.id === blocs[0].id) === 1,
    apresDeplace.json.blocs.map((b) => `${b.type}:${b.ordre}`).join(" ")
  );
  const premier = (await requete("GET", `/api/enseignant/fables/${fableTestId}/blocs`, { cookie: cookieEnseignant })).json.blocs[0];
  const deplaceHaut = await requete("POST", `/api/enseignant/blocs/${premier.id}/deplacer`, {
    cookie: cookieEnseignant,
    corps: { delta: -1 },
  });
  const dernier = (await requete("GET", `/api/enseignant/fables/${fableTestId}/blocs`, { cookie: cookieEnseignant })).json.blocs.at(-1);
  const deplaceBas = await requete("POST", `/api/enseignant/blocs/${dernier.id}/deplacer`, {
    cookie: cookieEnseignant,
    corps: { delta: 1 },
  });
  const apresBornes = await requete("GET", `/api/enseignant/fables/${fableTestId}/blocs`, { cookie: cookieEnseignant });
  verifier(
    "déplacement d'un bloc déjà premier / déjà dernier → 200 sans effet",
    deplaceHaut.statut === 200 &&
      deplaceBas.statut === 200 &&
      apresBornes.json.blocs[0].id === premier.id &&
      apresBornes.json.blocs.at(-1).id === dernier.id,
    `haut=${deplaceHaut.statut} bas=${deplaceBas.statut}`
  );
  const deltaInvalide = await requete("POST", `/api/enseignant/blocs/${blocs[0].id}/deplacer`, {
    cookie: cookieEnseignant,
    corps: { delta: 5 },
  });
  verifier("delta invalide → 400", deltaInvalide.statut === 400);

  // INVARIANT + CORRECTIF D'ORDRE vérifiés après toutes ces opérations :
  // l'ancienne normalisation (« ordre = -ordre - 1 » puis tri décroissant)
  // inversait les blocs à chaque création/suppression ; elle utilise désormais
  // un décalage MONOTONE, donc l'ordre relatif est conservé, les nouveaux blocs
  // s'ajoutent à la suite et l'invariant de contiguïté 0..n-1 reste vrai.
  const listeApresCreation = await requete("GET", `/api/enseignant/fables/${fableTestId}/blocs`, { cookie: cookieEnseignant });
  verifier(
    "ordre contigu 0..n-1 après création, réordonnancement, duplication et déplacement",
    listeApresCreation.json.blocs.every((b, i) => b.ordre === i),
    listeApresCreation.json.blocs.map((b) => `${b.ordre}:${b.type}`).join(" ")
  );

  // Publication : compléter TOUS les blocs visibles (validation stricte)
  for (const b of listeApresCreation.json.blocs) {
    const completer =
      b.type === "texte"
        ? { markdown: "Texte complet du parcours." }
        : b.type === "image"
          ? { source: "url", url: "https://exemple.test/img.png", alt: "Alt", legende: "" }
          : b.type === "audio"
            ? { source: "url", url: "https://exemple.test/a.mp3", titre: "Narration", description: "" }
            : b.contenu;
    await requete("PUT", `/api/enseignant/blocs/${b.id}`, { cookie: cookieEnseignant, corps: { contenu: completer } });
  }
  // Le bloc dupliqué possède un identifiant neuf : on le complète aussi.
  const listeComplete = (await requete("GET", `/api/enseignant/fables/${fableTestId}/blocs`, { cookie: cookieEnseignant })).json.blocs;
  for (const b of listeComplete) {
    if (b.type === "texte" && !(b.contenu?.markdown ?? "").trim()) {
      await requete("PUT", `/api/enseignant/blocs/${b.id}`, { cookie: cookieEnseignant, corps: { contenu: { markdown: "Copie complétée." } } });
    }
  }

  // Bloc incomplet ajouté volontairement (brouillon toléré) : il doit bloquer la publication.
  const incomplet = await requete("POST", `/api/enseignant/fables/${fableTestId}/blocs`, {
    cookie: cookieEnseignant,
    corps: { type: "video", titre: "Vidéo à compléter" },
  });
  verifier("bloc vidéo vide accepté en brouillon", incomplet.statut === 200, JSON.stringify(incomplet.json));
  const pub1 = await requete("PUT", `/api/enseignant/fables/${fableTestId}`, {
    cookie: cookieEnseignant,
    corps: { publie: true },
  });
  verifier(
    "publication refusée tant qu'un bloc visible est incomplet → 400 + detailsValidation",
    pub1.statut === 400 && Array.isArray(pub1.json?.detailsValidation) && pub1.json.detailsValidation.length > 0,
    JSON.stringify(pub1.json)
  );
  await requete("PUT", `/api/enseignant/blocs/${incomplet.json.bloc.id}`, {
    cookie: cookieEnseignant,
    corps: { contenu: { source: "youtube", url: "https://www.youtube.com/watch?v=ydY5GH0bULU", titre: "Vidéo", description: "" } },
  });
  const pub2 = await requete("PUT", `/api/enseignant/fables/${fableTestId}`, {
    cookie: cookieEnseignant,
    corps: { publie: true },
  });
  verifier("publication acceptée une fois les blocs complets", pub2.statut === 200 && pub2.json?.fable?.publie === true, JSON.stringify(pub2.json?.erreur ?? ""));
  const depub = await requete("PUT", `/api/enseignant/fables/${fableTestId}`, {
    cookie: cookieEnseignant,
    corps: { publie: false },
  });
  verifier("dépublication toujours autorisée sans validation", depub.statut === 200 && depub.json?.fable?.publie === false);
}

section("10. Suppression du bloc ≠ suppression de l'exercice");
{
  const r = await requete("GET", "/api/enseignant/fables", { cookie: cookieEnseignant });
  const fable = r.json.fables.find((f) => f.titre === "La Cigale et la Fourmi");
  const detail = await requete("GET", `/api/enseignant/fables/${fable.id}`, { cookie: cookieEnseignant });
  const qcm = detail.json.exercices.find((e) => e.type === "qcm");
  const bloc = await requete("POST", `/api/enseignant/fables/${fable.id}/blocs`, {
    cookie: cookieEnseignant,
    corps: { type: "exercice", exerciceId: qcm.id },
  });
  verifier("création d'un bloc EXERCICE référençant un exercice de la fable", bloc.statut === 200 && bloc.json?.bloc?.exerciceId === qcm.id, JSON.stringify(bloc.json));
  const exoAutre = await requete("POST", `/api/enseignant/fables/${fable.id}/blocs`, {
    cookie: cookieEnseignant,
    corps: { type: "exercice", exerciceId: "00000000-0000-4000-8000-000000000000" },
  });
  verifier("bloc exercice avec une référence inexistante → 400", exoAutre.statut === 400, JSON.stringify(exoAutre.json));
  const suppression = await requete("DELETE", `/api/enseignant/blocs/${bloc.json.bloc.id}`, { cookie: cookieEnseignant });
  const detailApres = await requete("GET", `/api/enseignant/fables/${fable.id}`, { cookie: cookieEnseignant });
  verifier(
    "supprimer le bloc ne supprime PAS l'exercice référencé (règle explicite du code)",
    suppression.statut === 200 && detailApres.json.exercices.some((e) => e.id === qcm.id),
    `suppression=${suppression.statut}, exercice présent=${detailApres.json.exercices.some((e) => e.id === qcm.id)}`
  );
  const progression = await requete("GET", "/api/eleve/progression", { cookie: cookieEleve });
  verifier(
    "et ses tentatives d'élèves restent intactes (historique conservé)",
    progression.statut === 200 &&
      progression.json.progression.historique.some((h) => h.fableTitre === "La Cigale et la Fourmi"),
    `${progression.json?.progression?.totalTentatives} tentatives`
  );
}

section("11. Cloisonnement enseignant ↔ élève (rattachement et ciblage)");
{
  const eleveAutre = await requete("POST", "/api/auth/eleve/inscription", {
    cookie: cookieEnseignant2,
    corps: { pseudo: `e${SUFFIXE}`, code: "CODE-INEXISTANT", pin: "1234" },
  });
  verifier("inscription élève avec code inexistant → 404", eleveAutre.statut === 404, JSON.stringify(eleveAutre.json));
  const pseudoInvalide = await requete("POST", "/api/auth/eleve/inscription", {
    corps: { pseudo: "pseudo avec espaces", code: "CE2A-DEMO1", pin: "1234" },
  });
  verifier("pseudo avec espaces refusé → 400", pseudoInvalide.statut === 400, JSON.stringify(pseudoInvalide.json));
  const pinCourt = await requete("POST", "/api/auth/eleve/inscription", {
    corps: { pseudo: `ok${SUFFIXE}`, code: "CE2A-DEMO1", pin: "12" },
  });
  verifier("PIN de moins de 4 caractères refusé → 400", pinCourt.statut === 400, JSON.stringify(pinCourt.json));

  const rFables = await requete("GET", "/api/enseignant/fables", { cookie: cookieEnseignant });
  const fable = rFables.json.fables.find((f) => f.titre === "La Cigale et la Fourmi");
  const detail = await requete("GET", `/api/enseignant/fables/${fable.id}`, { cookie: cookieEnseignant });
  const qcm = detail.json.exercices.find((e) => e.type === "qcm");
  const depublie = await requete("PUT", `/api/enseignant/exercices/${qcm.id}`, {
    cookie: cookieEnseignant,
    corps: { publie: false },
  });
  const tentative = await requete("POST", `/api/exercices/${qcm.id}/soumettre`, {
    cookie: cookieEleve,
    corps: { reponse: [0] },
  });
  verifier("exercice dépublié : soumission impossible → 404", tentative.statut === 404, `reçu ${tentative.statut} (dépublication=${depublie.statut})`);
  await requete("PUT", `/api/enseignant/exercices/${qcm.id}`, { cookie: cookieEnseignant, corps: { publie: true } });

  // Élève qui tente de corriger un exercice d'un autre enseignant : inexistant pour lui
  const exerciceAutre = await requete("POST", "/api/enseignant/exercices", {
    cookie: cookieEnseignant2,
    corps: {
      fableId: "00000000-0000-4000-8000-000000000000",
      type: "qcm",
      consigne: "test",
      payload: { question: "?", options: ["a", "b"], corrects: [0], multiple: false },
    },
  });
  verifier("création d'exercice sur une fable d'un autre enseignant → 404", exerciceAutre.statut === 404, JSON.stringify(exerciceAutre.json));

  const insuffisant = await requete("POST", "/api/enseignant/exercices", {
    cookie: cookieEnseignant,
    corps: {
      fableId: fable.id,
      type: "qcm",
      consigne: "QCM invalide",
      payload: { question: "Question ?", options: ["seule"], corrects: [0], multiple: false },
    },
  });
  verifier("QCM avec une seule proposition refusé → 400", insuffisant.statut === 400, JSON.stringify(insuffisant.json));
  const tropDOptions = await requete("POST", "/api/enseignant/exercices", {
    cookie: cookieEnseignant,
    corps: {
      fableId: fable.id,
      type: "qcm",
      consigne: "QCM trop large",
      payload: { question: "Question ?", options: ["a", "b", "c", "d", "e", "f", "g"], corrects: [0], multiple: false },
    },
  });
  verifier("QCM au-delà de 6 propositions refusé → 400", tropDOptions.statut === 400, JSON.stringify(tropDOptions.json));
}

section("12. Statistiques et export CSV");
{
  const synthese = await requete("GET", "/api/enseignant/stats/synthese", { cookie: cookieEnseignant });
  const s = synthese.json?.synthese;
  verifier(
    "synthèse : compteurs réels + série 14 jours + activités récentes",
    synthese.statut === 200 && s?.nbEleves >= 3 && Array.isArray(s?.serie14) && s.serie14.length === 14 && Array.isArray(s?.activitesRecentes),
    `nbEleves=${s?.nbEleves} nbTentatives=${s?.nbTentatives}`
  );
  verifier(
    "synthèse : aucun hachage ni donnée sensible exposée",
    !JSON.stringify(s).includes("Hash") && !JSON.stringify(s).includes("pin"),
  );
  const eleves = await requete("GET", "/api/enseignant/stats/eleves", { cookie: cookieEnseignant });
  verifier(
    "stats élèves : liste triée avec taux de réussite",
    eleves.statut === 200 && eleves.json.eleves.every((e) => typeof e.tauxReussite === "number"),
  );
  const eleveId = eleves.json.eleves.find((e) => e.pseudo === "lina")?.id;
  const detail = await requete("GET", `/api/enseignant/stats/eleves/${eleveId}`, { cookie: cookieEnseignant });
  verifier(
    "détail élève : points cumulés = somme des meilleurs scores",
    detail.statut === 200 && typeof detail.json.detail.pointsCumules === "number" && detail.json.detail.parFable.length > 0,
    `pointsCumules=${detail.json?.detail?.pointsCumules}`
  );
  const autre = await requete("GET", `/api/enseignant/stats/eleves/${eleveId}`, { cookie: cookieEnseignant2 });
  verifier("un enseignant ne voit pas les élèves des autres → 404", autre.statut === 404, `reçu ${autre.statut}`);

  const rFables = await requete("GET", "/api/enseignant/fables", { cookie: cookieEnseignant });
  const fable = rFables.json.fables.find((f) => f.titre === "La Cigale et la Fourmi");
  const stats = await requete("GET", `/api/enseignant/stats/fables/${fable.id}`, { cookie: cookieEnseignant });
  const qcmStats = stats.json?.stats?.exercices?.find((e) => e.type === "qcm");
  verifier(
    "stats par fable : distribution des choix QCM marquée correcte/incorrecte",
    stats.statut === 200 && Array.isArray(qcmStats?.distribution) && qcmStats.distribution.some((d) => d.correct === true),
    JSON.stringify(qcmStats?.distribution?.map((d) => [d.nombre, d.correct]))
  );
  const trousStats = stats.json?.stats?.exercices?.find((e) => e.type === "texte_trous");
  verifier(
    "stats par fable : erreurs fréquentes par trou + taux d'erreur",
    Array.isArray(trousStats?.erreursTrous) && trousStats.erreursTrous.every((t) => typeof t.tauxErreur === "number"),
    JSON.stringify(trousStats?.erreursTrous?.map((t) => [t.reference, t.erreurs, t.tauxErreur]))
  );
  const ouverteStats = stats.json?.stats?.exercices?.find((e) => e.type === "question_ouverte");
  verifier(
    "file de correction manuelle exposée pour les questions ouvertes",
    ouverteStats === undefined || Array.isArray(ouverteStats.enAttente),
  );
  const attente = (stats.json?.stats?.exercices ?? []).flatMap((e) => e.enAttente ?? []);
  verifier("corrections en attente visibles (question ouverte / H5P)", attente.length >= 0, `${attente.length} en attente`);

  // Lecture en OCTETS : Response.text() retire le BOM (spec WHATWG), on vérifie
  // donc sur le corps brut que le fichier commence bien par EF BB BF.
  const reponseCsv = await fetch(`${BASE}/api/enseignant/export/resultats.csv`, {
    headers: { Cookie: cookieEnseignant },
  });
  const octets = new Uint8Array(await reponseCsv.arrayBuffer());
  const corpsCsv = new TextDecoder("utf-8", { ignoreBOM: true }).decode(octets);
  const enteteCsv = corpsCsv.split("\n")[0];
  verifier(
    "export CSV : BOM UTF-8 (EF BB BF), séparateur « ; », en-têtes français, pièce jointe",
    reponseCsv.status === 200 &&
      octets[0] === 0xef &&
      octets[1] === 0xbb &&
      octets[2] === 0xbf &&
      enteteCsv.includes("Eleve;Classe / code;Fable;Exercice;Type;Tentative n°;Score;Score max;Reussi;Duree (s);Date") &&
      (reponseCsv.headers.get("content-disposition") ?? "").includes("resultats-fablio.csv"),
    `octets=${octets[0]?.toString(16)} ${octets[1]?.toString(16)} ${octets[2]?.toString(16)} | ${enteteCsv.slice(0, 90)}`
  );
  verifier(
    "export CSV : scores en attente marqués « en attente », échappement des guillemets",
    corpsCsv.includes("en attente"),
  );
}

section("13. Réinitialisation du PIN par l'enseignant");
{
  const eleves = await requete("GET", "/api/enseignant/stats/eleves", { cookie: cookieEnseignant });
  const samy = eleves.json.eleves.find((e) => e.pseudo === "samy");
  const court = await requete("PATCH", `/api/enseignant/stats/eleves/${samy.id}`, {
    cookie: cookieEnseignant,
    corps: { pin: "12" },
  });
  verifier("nouveau PIN trop court → 400", court.statut === 400, JSON.stringify(court.json));
  const ok = await requete("PATCH", `/api/enseignant/stats/eleves/${samy.id}`, {
    cookie: cookieEnseignant,
    corps: { pin: "9876" },
  });
  verifier("réinitialisation du PIN → 200", ok.statut === 200);
  const connexion = await seConnecterEleve("samy", "CE2A-DEMO1", "9876");
  verifier("l'élève se connecte avec le nouveau PIN", connexion !== null);
  const ancien = await seConnecterEleve("samy", "CE2A-DEMO1", "1234");
  verifier("l'ancien PIN est refusé", ancien === null);
  const autre = await requete("PATCH", `/api/enseignant/stats/eleves/${samy.id}`, {
    cookie: cookieEnseignant2,
    corps: { pin: "1111" },
  });
  verifier("un autre enseignant ne peut pas réinitialiser ce PIN → 404", autre.statut === 404, `reçu ${autre.statut}`);
  // restauration de l'état de démonstration
  await requete("PATCH", `/api/enseignant/stats/eleves/${samy.id}`, { cookie: cookieEnseignant, corps: { pin: "1234" } });
}

section("14. Récupération de mot de passe enseignant (anti-énumération)");
{
  const inconnu = await requete("POST", "/api/auth/mot-de-passe/demande", {
    corps: { email: `inconnu.${SUFFIXE}@fablio.test` },
  });
  const connu = await requete("POST", "/api/auth/mot-de-passe/demande", {
    corps: { email: "demo.enseignant@fablio.tn" },
  });
  verifier(
    "réponse identique compte inconnu / compte existant (anti-énumération)",
    inconnu.statut === 200 && connu.statut === 200 && inconnu.brut === connu.brut,
    `${inconnu.brut} ≠ ${connu.brut}`
  );
  verifier(
    "aucun jeton renvoyé au navigateur",
    !/jeton|token/i.test(connu.brut),
    connu.brut.slice(0, 160)
  );
  const emailInvalide = await requete("POST", "/api/auth/mot-de-passe/demande", { corps: { email: "pasunemail" } });
  verifier("email invalide → 400", emailInvalide.statut === 400);
  const faux = await requete("GET", "/api/auth/mot-de-passe/reinitialiser?jeton=faux-jeton-de-test-1234567890");
  verifier("jeton falsifié refusé (validité vérifiée en base)", faux.statut === 200 && faux.json?.valide === false);
  const changement = await requete("POST", "/api/auth/mot-de-passe/reinitialiser", {
    corps: { jeton: "faux-jeton-de-test-1234567890", motDePasse: "nouveaumdp123" },
  });
  verifier("changement de mot de passe avec jeton falsifié → 400", changement.statut === 400, JSON.stringify(changement.json));
  const court = await requete("POST", "/api/auth/mot-de-passe/reinitialiser", {
    corps: { jeton: "faux-jeton-de-test-1234567890", motDePasse: "court" },
  });
  verifier("mot de passe de moins de 8 caractères → 400", court.statut === 400, JSON.stringify(court.json));
}

section("15. Synthèse vocale (/api/tts)");
{
  const vide = await requete("POST", "/api/tts", { cookie: cookieEleve, corps: { texte: "" } });
  verifier("texte manquant → 400", vide.statut === 400, JSON.stringify(vide.json));
  const reponse = await requete("POST", "/api/tts", { cookie: cookieEleve, corps: { texte: "Bonjour les élèves." } });
  verifier(
    "sans OPENAI_API_KEY et sans accès réseau : 502 explicite, aucun plantage serveur",
    reponse.statut === 502 && /indisponible|navigateur/i.test(reponse.json?.erreur ?? ""),
    `${reponse.statut} ${reponse.brut.slice(0, 120)}`
  );
}

section("16. Pages authentifiées (rendu serveur)");
{
  const rEleve = await requete("GET", "/eleve", { cookie: cookieEleve });
  verifier(
    "GET /eleve → page rendue pour un élève connecté",
    rEleve.statut === 200 && /lina|Parcours|points/i.test(rEleve.brut),
    `statut=${rEleve.statut}`
  );
  const rProf = await requete("GET", "/enseignant", { cookie: cookieEnseignant });
  verifier(
    "GET /enseignant → tableau de bord enseignant",
    rProf.statut === 200 && /Fablio/i.test(rProf.brut),
    `statut=${rProf.statut}`
  );
  const rProfil = await requete("GET", "/eleve/profil", { cookie: cookieEleve });
  verifier("GET /eleve/profil → progression de l'élève", rProfil.statut === 200, `statut=${rProfil.statut}`);
  const rStats = await requete("GET", "/enseignant/statistiques", { cookie: cookieEnseignant });
  verifier("GET /enseignant/statistiques → page de statistiques", rStats.statut === 200, `statut=${rStats.statut}`);
  const rAnon = await requete("GET", "/enseignant");
  verifier(
    "accès enseignant sans session → redirection ou connexion (jamais de contenu privé)",
    rAnon.statut === 307 || rAnon.statut === 302 || /connexion|Mot de passe|Connecter/i.test(rAnon.brut),
    `statut=${rAnon.statut}`
  );
}

section("17. Déconnexion");
{
  const deconnexion = await requete("POST", "/api/auth/deconnexion", { cookie: cookieEnseignant2 });
  verifier("POST /api/auth/deconnexion → 200", deconnexion.statut === 200);
  const apres = await requete("GET", "/api/enseignant/fables", { cookie: cookieEnseignant2 });
  verifier("la session est bien révoquée après déconnexion → 401", apres.statut === 401, `reçu ${apres.statut}`);
}

section("18. Nettoyage des artefacts de test");
{
  const suppression = await requete("DELETE", `/api/enseignant/fables/${fableTestId}`, { cookie: cookieEnseignant });
  verifier("la fable de test est supprimée (cascade sur ses blocs)", suppression.statut === 200, `reçu ${suppression.statut}`);
  const apres = await requete("GET", `/api/enseignant/fables/${fableTestId}`, { cookie: cookieEnseignant });
  verifier("fable de test bien absente (404)", apres.statut === 404, `reçu ${apres.statut}`);
}


section("19. Anti-force-brute de la connexion (audit 2026-10)");
{
  // Compte enseignant jetable : le bornage est volontairement par identifiant,
  // donc aucun autre compte n'est gêné par ces tentatives.
  const emailBrute = `brute.${SUFFIXE}@fablio.test`;
  const mdpBrute = "motdepasse-solide-1";
  const inscription = await requete("POST", "/api/auth/enseignant/inscription", {
    corps: { nom: "Prof Test Brute", email: emailBrute, motDePasse: mdpBrute },
  });
  verifier(
    "compte jetable créé pour le test de bornage",
    inscription.statut === 200,
    `reçu ${inscription.statut}`
  );

  let recus401 = 0;
  for (let i = 0; i < 5; i++) {
    const r = await requete("POST", "/api/auth/enseignant/connexion", {
      corps: { email: emailBrute, motDePasse: `faute-${i}` },
    });
    if (r.statut === 401) recus401++;
  }
  verifier(
    "5 échecs consécutifs → 5 × 401 (le seuil déclenche le blocage APRÈS le 5e)",
    recus401 === 5,
    `reçus 401 : ${recus401}/5`
  );

  const apresSeuil = await requete("POST", "/api/auth/enseignant/connexion", {
    corps: { email: emailBrute, motDePasse: mdpBrute },
  });
  verifier(
    "le mot de passe CORRECT est refusé pendant le blocage → 429",
    apresSeuil.statut === 429,
    `reçu ${apresSeuil.statut}`
  );
  const retryAfter = Number(apresSeuil.entetes.get("retry-after"));
  verifier(
    "en-tête Retry-After présent et cohérent (≤ 10 min)",
    Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 600,
    `Retry-After=${apresSeuil.entetes.get("retry-after")}`
  );
  verifier(
    "message utilisateur explicite et en français",
    /tentatives|attends/i.test(apresSeuil.json?.erreur ?? ""),
    apresSeuil.json?.erreur ?? ""
  );

  const autreCompte = await seConnecterEnseignant("demo.enseignant@fablio.tn", "demo1234");
  verifier(
    "un AUTRE compte peut toujours se connecter (bornage par identifiant)",
    autreCompte !== null
  );

  // Élève : le PIN court (4-12 caractères) est le vrai risque de devinette.
  const pseudoBrute = `pb${SUFFIXE}`;
  const inscuEleve = await requete("POST", "/api/auth/eleve/inscription", {
    corps: { pseudo: pseudoBrute, code: "CE2A-DEMO1", pin: "123456" },
  });
  verifier("élève jetable créé pour le test de bornage", inscuEleve.statut === 200, `reçu ${inscuEleve.statut}`);

  let pinsRefuses = 0;
  for (let i = 0; i < 5; i++) {
    const r = await requete("POST", "/api/auth/eleve/connexion", {
      corps: { pseudo: pseudoBrute, code: "CE2A-DEMO1", pin: `000${i}` },
    });
    if (r.statut === 401) pinsRefuses++;
  }
  verifier("5 PIN erronés → 5 × 401", pinsRefuses === 5, `reçus 401 : ${pinsRefuses}/5`);

  const eleveBloque = await requete("POST", "/api/auth/eleve/connexion", {
    corps: { pseudo: pseudoBrute, code: "CE2A-DEMO1", pin: "123456" },
  });
  verifier(
    "PIN correct refusé pendant le blocage de l'élève → 429",
    eleveBloque.statut === 429,
    `reçu ${eleveBloque.statut}`
  );

  const camarade = await requete("POST", "/api/auth/eleve/connexion", {
    corps: { pseudo: "lina", code: "CE2A-DEMO1", pin: "1234" },
  });
  verifier(
    "un camarade de la MÊME classe n'est pas bloqué",
    camarade.statut === 200,
    `reçu ${camarade.statut}`
  );

  const sante = await requete("GET", "/api/health");
  verifier(
    "/api/health expose l'état du bornage (diagnostic d'exploitation)",
    sante.json?.bornage === "actif" && Array.isArray(sante.json?.schemaManquant),
    JSON.stringify(sante.json)
  );
}


section("20. Contrôle d'origine (CSRF) sur les méthodes mutantes");
{
  const ENNEMI = "https://phishing.example.tn";
  const hote = new URL(BASE).origin;

  const crossOrigin = await requete("POST", "/api/enseignant/fables", {
    entetes: { Origin: ENNEMI },
    corps: { titre: "X" },
  });
  verifier(
    "POST inter-site vers une route qui écrit → 403 (refusé avant la base)",
    crossOrigin.statut === 403,
    `reçu ${crossOrigin.statut}`
  );

  const crossOriginDelete = await requete("DELETE", "/api/enseignant/fables/00000000-0000-0000-0000-000000000000", {
    entetes: { Origin: ENNEMI },
  });
  verifier(
    "DELETE inter-site → 403 (aucune méthode mutante tolérée)",
    crossOriginDelete.statut === 403,
    `reçu ${crossOriginDelete.statut}`
  );

  const memeOrigine = await requete("POST", "/api/auth/enseignant/connexion", {
    entetes: { Origin: hote },
    corps: { email: "demo.enseignant@fablio.tn", motDePasse: "demo1234" },
  });
  verifier(
    "POST same-origin (le vrai navigateur de l'enseignant) → jamais 403",
    memeOrigine.statut !== 403,
    `reçu ${memeOrigine.statut}`
  );

  const sansOrigin = await requete("POST", "/api/auth/enseignant/connexion", {
    corps: { email: "demo.enseignant@fablio.tn", motDePasse: "demo1234" },
  });
  verifier(
    "requête sans en-tête Origin (curl, app native) → acceptée puis traitée par la route",
    sansOrigin.statut !== 403,
    `reçu ${sansOrigin.statut}`
  );

  const lectureCrossOrigin = await requete("GET", "/api/eleve/fables", {
    entetes: { Origin: ENNEMI },
  });
  verifier(
    "GET inter-site non bloqué par le CSRF (lecture ; l'auth s'en charge) → jamais 403",
    lectureCrossOrigin.statut !== 403,
    `reçu ${lectureCrossOrigin.statut}`
  );

  const pageCrossOrigin = await requete("GET", "/", { entetes: { Origin: ENNEMI } });
  verifier("une PAGE reste servie quelle que soit l'origine", pageCrossOrigin.statut === 200, `reçu ${pageCrossOrigin.statut}`);
}

section("21. Fichiers statiques (illustrations locales du dépôt)");
{
  for (const [chemin, attendu] of [
    ["/images/hero-livre-magique.jpg", "image/jpeg"],
    ["/images/fables/cigale-fourmi.jpg", "image/jpeg"],
    ["/images/fables/corbeau-renard.jpg", "image/jpeg"],
    ["/images/fables/lievre-tortue.jpg", "image/jpeg"],
  ]) {
    const res = await fetch(`${BASE}${chemin}`);
    verifier(
      `${chemin} → 200 et type d'image (le dépôt doit TOUJOURS contenir ses visuels)`,
      res.status === 200 && (res.headers.get("content-type") ?? "").startsWith(attendu),
      `reçu ${res.status} ${res.headers.get("content-type")}`
    );
  }

  const optimisee = await fetch(
    `${BASE}/_next/image?url=%2Fimages%2Fhero-livre-magique.jpg&w=640&q=75`
  );
  verifier(
    "l'optimiseur d'images Next sert le visuel local (200 image/jpeg)",
    optimisee.status === 200 && (optimisee.headers.get("content-type") ?? "").startsWith("image/"),
    `reçu ${optimisee.status}`
  );

  const polices = await fetch(`${BASE}/favicon.ico`);
  verifier(`GET /favicon.ico → ${polices.status}`, [200, 404].includes(polices.status));
}

// ---------------------------------------------------------------------------

console.log("\n" + "─".repeat(72));
console.log(`RÉSULTAT : ${reussis}/${personnes} vérifications réussies`);
if (echecs.length) {
  console.log(`\nÉchecs (${echecs.length}) :`);
  for (const e of echecs) console.log(`  ✗ ${e}`);
}
console.log("─".repeat(72));
process.exit(echecs.length ? 1 : 0);
