// ---------------------------------------------------------------------------
// Données de démonstration Fablio (idempotent : ON CONFLICT DO NOTHING)
//
//   Enseignant : demo.enseignant@fablio.tn / demo1234
//   Codes      : CE2A-DEMO1 (Groupe A) · CE2B-DEMO2 (Groupe B)
//   Élèves     : lina, samy (Groupe A) · nour (Groupe B) — code secret : 1234
//
// Lancer avec : node scripts/seed.mjs
// ---------------------------------------------------------------------------

import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Client } = pg;

const T = {
  enseignant: "11111111-1111-4000-8000-111111111111",
  codeA: "22222222-2222-4000-8000-222222222221",
  codeB: "22222222-2222-4000-8000-222222222222",
  fableCigale: "33333333-3333-4000-8000-333333333331",
  fableCorbeau: "33333333-3333-4000-8000-333333333332",
  fableLievre: "33333333-3333-4000-8000-333333333333",
  exQcmCigale: "44444444-4444-4000-8000-444444444441",
  exVfCigale: "44444444-4444-4000-8000-444444444442",
  exTrousCigale: "44444444-4444-4000-8000-444444444443",
  exOrdreCorbeau: "44444444-4444-4000-8000-444444444444",
  exAssocCorbeau: "44444444-4444-4000-8000-444444444445",
  exQcmLievre: "44444444-4444-4000-8000-444444444446",
  exOuverteLievre: "44444444-4444-4000-8000-444444444447",
  exVideoLievre: "44444444-4444-4000-8000-444444444448",
  exH5pCorbeau: "44444444-4444-4000-8000-444444444449",
  lina: "55555555-5555-4000-8000-555555555551",
  samy: "55555555-5555-4000-8000-555555555552",
  nour: "55555555-5555-4000-8000-555555555553",
};

const TEXTE_CIGALE = `La Cigale, ayant chanté
Tout l'été,
Se trouva fort dépourvue
Quand la bise fut venue :
Pas un seul petit morceau
De mouche ou de vermisseau.

Elle alla crier famine
Chez la Fourmi sa voisine,
La priant de lui prêter
Quelque grain pour subsister
Jusqu'à la saison nouvelle.
« Je vous paierai, lui dit-elle,
Avant l'Oût, foi d'animal,
Intérêt et principal. »

La Fourmi n'est pas prêteuse :
C'est là son moindre défaut.
« Que faisiez-vous au temps chaud ?
Dit-elle à cette emprunteuse.
— Nuit et jour à tout venant
Je chantais, ne vous déplaise.
— Vous chantiez ? j'en suis fort aise.
Eh bien ! dansez maintenant. »`;

const TEXTE_CORBEAU = `Maître Corbeau, sur un arbre perché,
Tenait en son bec un fromage.
Maître Renard, par l'odeur alléché,
Lui tint à peu près ce langage :
« Hé ! bonjour, Monsieur du Corbeau.
Que vous êtes joli ! que vous me semblez beau !
Sans mentir, si votre ramage
Se rapporte à votre plumage,
Vous êtes le Phénix des hôtes de ces bois. »

À ces mots le Corbeau ne se sent pas de joie ;
Et pour montrer sa belle voix,
Il ouvre un large bec, laisse tomber sa proie.

Le Renard s'en saisit, et dit : « Mon bon Monsieur,
Apprenez que tout flatteur
Vit aux dépens de celui qui l'écoute :
Cette leçon vaut bien un fromage, sans doute. »

Le Corbeau, honteux et confus,
Jura, mais un peu tard, qu'on ne l'y prendrait plus.`;

const TEXTE_LIEVRE = `*Rien ne sert de courir ; il faut partir à point.*

Le Lièvre et la Tortue en sont un témoignage.

« Gageons, dit celle-ci, que vous n'atteindrez point
Si tôt que moi ce but. — Si tôt ? Êtes-vous sage ?
Reprit l'animal léger.
— Sage ou non, je parie encore. »

Ainsi fut fait. Notre Lièvre n'avait que quatre pas à faire ;
Ayant du temps de reste pour brouter,
Pour dormir, et pour écouter
D'où vient le vent, il laisse la Tortue
Aller son train de sénateur.
Elle part, elle s'évertue ;
Elle se hâte avec lenteur.

Lui cependant méprise une telle victoire,
Croit qu'il y va de son honneur
De partir tard. Il broute, il se repose,
Il s'amuse à toute autre chose
Qu'à la gageure. À la fin, quand il vit
Que l'autre touchait presque au bout de la carrière,
Il partit comme un trait ; mais les élans qu'il fit
Furent vains : la Tortue arriva la première.

« Eh bien ! lui cria-t-elle, avais-je pas raison ?
De quoi vous sert votre vitesse ?
Moi l'emporter ! et que serait-ce
Si vous portiez une maison ? »`;

function ilYAJours(j, heure = 17) {
  const d = new Date();
  d.setDate(d.getDate() - j);
  d.setHours(heure, Math.floor(Math.random() * 50), 0, 0);
  return d;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante (fichier .env).");
  const client = new Client({ connectionString: url });
  await client.connect();

  const hashMdp = await bcrypt.hash("demo1234", 10);
  const hashPin = await bcrypt.hash("1234", 10);

  // --- Enseignant -----------------------------------------------------------
  await client.query(
    `INSERT INTO enseignants (id, nom, email, mot_de_passe_hash)
     VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
    [T.enseignant, "Mme Amira Ben Salah", "demo.enseignant@fablio.tn", hashMdp]
  );

  // --- Codes de parrainage --------------------------------------------------
  await client.query(
    `INSERT INTO codes_parrainage (id, enseignant_id, code, etiquette)
     VALUES ($1, $2, 'CE2A-DEMO1', 'CE2 · Groupe A') ON CONFLICT (id) DO NOTHING`,
    [T.codeA, T.enseignant]
  );
  await client.query(
    `INSERT INTO codes_parrainage (id, enseignant_id, code, etiquette)
     VALUES ($1, $2, 'CE2B-DEMO2', 'CE2 · Groupe B') ON CONFLICT (id) DO NOTHING`,
    [T.codeB, T.enseignant]
  );

  // --- Fables ---------------------------------------------------------------
  const VIDEO_LIEVRE = "https://www.youtube.com/watch?v=ydY5GH0bULU";

  const fablesData = [
    [
      T.fableCigale,
      "La Cigale et la Fourmi",
      TEXTE_CIGALE,
      "Il faut travailler aujourd'hui pour ne manquer de rien demain.",
      "/images/fables/cigale-fourmi.jpg",
      "facile",
      "",
    ],
    [
      T.fableCorbeau,
      "Le Corbeau et le Renard",
      TEXTE_CORBEAU,
      "Méfie-toi des flatteurs : ils profitent de ta vanité.",
      "/images/fables/corbeau-renard.jpg",
      "moyen",
      "",
    ],
    [
      T.fableLievre,
      "Le Lièvre et la Tortue",
      TEXTE_LIEVRE,
      "Rien ne sert de courir ; il faut partir à point.",
      "/images/fables/lievre-tortue.jpg",
      "facile",
      VIDEO_LIEVRE,
    ],
  ];
  for (const [id, titre, texte, morale, imageUrl, difficulte, videoUrl] of fablesData) {
    await client.query(
      `INSERT INTO fables (id, enseignant_id, titre, texte, morale, image_url, difficulte, video_url, publie)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) ON CONFLICT (id) DO NOTHING`,
      [id, T.enseignant, titre, texte, morale, imageUrl, difficulte, videoUrl]
    );
  }

  // --- Exercices ------------------------------------------------------------
  const exercicesData = [
    [
      T.exQcmCigale,
      T.fableCigale,
      "qcm",
      "Lis bien la fable, puis choisis la bonne réponse.",
      {
        question: "Pourquoi la Cigale se trouve-t-elle dépourvue à l'arrivée de l'hiver ?",
        options: [
          "Elle a chanté tout l'été sans rien mettre de côté",
          "La Fourmi lui a volé sa nourriture",
          "Le vent a emporté sa maison",
          "Elle a tout donné à ses voisines",
        ],
        corrects: [0],
        multiple: false,
      },
      10,
      "Bravo : la Cigale a chanté tout l'été au lieu de travailler !",
      "Relis le début de la fable : que faisait la Cigale pendant l'été ?",
      0,
    ],
    [
      T.exVfCigale,
      T.fableCigale,
      "vrai_faux",
      "Dis si cette phrase est vraie ou fausse.",
      { enonce: "À la fin de la fable, la Fourmi prête des grains à la Cigale.", reponse: false },
      5,
      "Exact ! La Fourmi refuse et envoie la Cigale danser.",
      "Attention : relis les dernières répliques de la Fourmi.",
      1,
    ],
    [
      T.exTrousCigale,
      T.fableCigale,
      "texte_trous",
      "Complète cet extrait de la fable avec les mots qui manquent.",
      {
        segments: [
          "La Cigale, ayant ",
          " tout l'été, se trouva fort ",
          " quand la bise fut venue.",
        ],
        reponses: [["chanté", "chante"], ["dépourvue", "depourvue"]],
        afficherBanque: true,
        banque: ["dansé", "riche", "pleuré"],
      },
      15,
      "Quelle mémoire ! C'est le début exact de la fable.",
      "Presque ! Regarde bien la première strophe de la fable.",
      2,
    ],
    [
      T.exOrdreCorbeau,
      T.fableCorbeau,
      "ordre",
      "Replace les événements de l'histoire dans le bon ordre.",
      {
        elements: [
          "Maître Corbeau tient un fromage dans son bec.",
          "Maître Renard flatte le Corbeau et admire son plumage.",
          "Le Corbeau ouvre son bec pour chanter.",
          "Le fromage tombe et le Renard s'en saisit.",
          "Le Renard donne une leçon au Corbeau.",
        ],
      },
      15,
      "Parfait : tu racontes l'histoire dans le bon ordre !",
      "Essaie de raconter l'histoire dans ta tête avant de classer.",
      0,
    ],
    [
      T.exAssocCorbeau,
      T.fableCorbeau,
      "association",
      "Relie chaque élément à ce qui lui correspond dans la fable.",
      {
        paires: [
          { gauche: "Maître Corbeau", droite: "tient un fromage dans son bec" },
          { gauche: "Maître Renard", droite: "flatte le Corbeau pour le tromper" },
          { gauche: "Le fromage", droite: "tombe du bec du Corbeau" },
          { gauche: "La morale", droite: "il faut se méfier des flatteurs" },
        ],
      },
      10,
      "Excellent : chaque personnage est à sa place !",
      "Revois qui fait quoi dans l'histoire.",
      1,
    ],
    [
      T.exQcmLievre,
      T.fableLievre,
      "qcm",
      "Choisis la morale de la fable.",
      {
        question: "Quelle est la morale de cette fable ?",
        options: [
          "Rien ne sert de courir, il faut partir à point",
          "Le plus rapide gagne toujours",
          "Il ne faut jamais faire de paris",
          "La Tortue a triché pour gagner",
        ],
        corrects: [0],
        multiple: false,
      },
      10,
      "C'est la morale exacte, donnée dès la première ligne !",
      "Cherche la phrase en italique au tout début de la fable.",
      0,
    ],
    [
      T.exOuverteLievre,
      T.fableLievre,
      "question_ouverte",
      "Réponds avec une phrase complète, avec tes propres mots.",
      {
        question: "Pourquoi le Lièvre perd-il la course alors qu'il est le plus rapide ?",
        corrigeType:
          "Il se croit sûr de gagner : il broute, dort, s'amuse et part trop tard. La Tortue, elle, avance sans jamais s'arrêter.",
        reponsesAcceptees: [],
      },
      10,
      "",
      "",
      1,
    ],
    [
      T.exVideoLievre,
      T.fableLievre,
      "video_interactive",
      "Regarde la vidéo : elle s'arrêtera pour te poser des questions.",
      {
        videoUrl: VIDEO_LIEVRE,
        arrets: [
          {
            temps: 25,
            question: "Qui propose le pari de la course ?",
            options: ["La Tortue", "Le Lièvre", "Le Renard"],
            correct: 0,
            explication: "C'est la Tortue qui lance le défi au Lièvre.",
          },
          {
            temps: 70,
            question: "Que fait le Lièvre pendant que la Tortue avance ?",
            options: [
              "Il court le plus vite possible",
              "Il broute, se repose et s'amuse",
              "Il aide la Tortue",
            ],
            correct: 1,
            explication: "Il perd son temps car il se croit sûr de gagner.",
          },
        ],
      },
      20,
      "Superbe ! Tu as bien suivi toute l'histoire.",
      "Regarde à nouveau ce passage de la vidéo.",
      2,
    ],
    [
      T.exH5pCorbeau,
      T.fableCorbeau,
      "h5p",
      "Fais l'activité interactive, puis coche la case quand tu as terminé.",
      {
        embedUrl: "https://h5p.org/h5p/embed/1396",
        titre: "Complète les phrases (activité H5P)",
        hauteur: 420,
        validationAutomatique: false,
        demanderScore: true,
      },
      10,
      "",
      "",
      2,
    ],
  ];
  for (const [id, fableId, type, consigne, payload, points, fc, fi, ordre] of exercicesData) {
    await client.query(
      `INSERT INTO exercices (id, fable_id, type, consigne, payload, points, feedback_correct, feedback_incorrect, ordre, publie)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) ON CONFLICT (id) DO NOTHING`,
      [id, fableId, type, consigne, JSON.stringify(payload), points, fc, fi, ordre]
    );
  }

  // --- Élèves ---------------------------------------------------------------
  const elevesData = [
    [T.lina, "lina", T.codeA],
    [T.samy, "samy", T.codeA],
    [T.nour, "nour", T.codeB],
  ];
  for (const [id, pseudo, codeId] of elevesData) {
    await client.query(
      `INSERT INTO eleves (id, enseignant_id, code_id, pseudo, pin_hash)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [id, T.enseignant, codeId, pseudo, hashPin]
    );
  }

  // --- Tentatives (historique réaliste) --------------------------------------
  const tentativesData = [
    // lina
    [T.lina, T.exQcmCigale, T.fableCigale, [1], 0, false, 1, 45, 5],
    [T.lina, T.exQcmCigale, T.fableCigale, [0], 10, true, 2, 22, 5],
    [T.lina, T.exVfCigale, T.fableCigale, false, 5, true, 1, 12, 5],
    [T.lina, T.exTrousCigale, T.fableCigale, ["chanté", "depourvu"], 7.5, false, 1, 68, 4],
    [T.lina, T.exTrousCigale, T.fableCigale, ["chanté", "dépourvue"], 15, true, 2, 40, 4],
    [T.lina, T.exOrdreCorbeau, T.fableCorbeau, [0, 2, 1, 3, 4], 12, false, 1, 95, 3],
    [T.lina, T.exOrdreCorbeau, T.fableCorbeau, [0, 1, 2, 3, 4], 15, true, 2, 55, 3],
    [T.lina, T.exAssocCorbeau, T.fableCorbeau, [0, 1, 2, 0], 7.5, false, 1, 60, 2],
    [T.lina, T.exQcmLievre, T.fableLievre, [0], 10, true, 1, 18, 1],
    [
      T.lina,
      T.exOuverteLievre,
      T.fableLievre,
      "Parce qu'il s'est moqué de la tortue et il a dormi au lieu de courir.",
      null,
      null,
      1,
      130,
      1,
    ],
    // samy
    [T.samy, T.exQcmCigale, T.fableCigale, [0], 10, true, 1, 30, 5],
    [T.samy, T.exVfCigale, T.fableCigale, true, 0, false, 1, 9, 5],
    [T.samy, T.exTrousCigale, T.fableCigale, ["chanter", "dépourvue"], 7.5, false, 1, 75, 4],
    [T.samy, T.exOrdreCorbeau, T.fableCorbeau, [0, 1, 2, 3, 4], 15, true, 1, 70, 3],
    [T.samy, T.exAssocCorbeau, T.fableCorbeau, [0, 1, 2, 3], 10, true, 1, 48, 2],
    [T.samy, T.exQcmLievre, T.fableLievre, [1], 0, false, 1, 15, 1],
    [T.samy, T.exQcmLievre, T.fableLievre, [0], 10, true, 2, 20, 1],
    // nour
    [T.nour, T.exQcmCigale, T.fableCigale, [0], 10, true, 1, 26, 2],
    [T.nour, T.exTrousCigale, T.fableCigale, ["chanté", "depourvues"], 7.5, false, 1, 80, 2],
    [
      T.nour,
      T.exOuverteLievre,
      T.fableLievre,
      "Il part trop tard parce qu'il se repose et il mange.",
      null,
      null,
      1,
      110,
      1,
    ],
    // Vidéo interactive : lina répond juste aux deux arrêts, samy se trompe une fois
    [T.lina, T.exVideoLievre, T.fableLievre, [0, 1], 20, true, 1, 140, 1],
    [T.samy, T.exVideoLievre, T.fableLievre, [1, 1], 10, false, 1, 155, 1],
    // Activité H5P : en attente de correction par l'enseignant
    [
      T.lina,
      T.exH5pCorbeau,
      T.fableCorbeau,
      "Activité H5P terminée — score annoncé par l'élève : 9/10",
      null,
      null,
      1,
      210,
      2,
    ],
  ];
  for (const [eleveId, exoId, fableId, reponse, score, ok, numero, duree, jours] of tentativesData) {
    await client.query(
      `INSERT INTO tentatives (eleve_id, exercice_id, fable_id, reponse, score, max_score, est_correct, numero, duree_secondes, cree_le)
       SELECT $1, $2, $3, $4, $5, e.points, $6, $7, $8, $9
       FROM exercices e
       WHERE e.id = $2
         AND NOT EXISTS (
           SELECT 1 FROM tentatives t
           WHERE t.eleve_id = $1 AND t.exercice_id = $2 AND t.numero = $7
         )
       LIMIT 1`,
      [
        eleveId,
        exoId,
        fableId,
        JSON.stringify(reponse),
        score,
        ok,
        numero,
        duree,
        ilYAJours(jours),
      ]
    );
  }

  const compte = await client.query(`SELECT COUNT(*)::int AS n FROM tentatives`);
  console.log(`Base de démonstration prête (${compte.rows[0].n} tentatives enregistrées).`);
  console.log("Enseignant : demo.enseignant@fablio.tn / demo1234");
  console.log("Codes classe : CE2A-DEMO1 · CE2B-DEMO2");
  console.log("Élèves : lina, samy, nour — code secret 1234");

  await client.end();
}

main().catch((err) => {
  console.error("Échec du seed :", err.message);
  process.exit(1);
});
