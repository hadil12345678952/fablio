// ---------------------------------------------------------------------------
// Migration des anciennes fables vers le modèle par blocs (blocs_fable).
//
//   Ancienne fable { texte, image_url, audio_url, video_url, exercices[] }
//     → fable { métadonnées inchangées } + blocs ordonnés.
//
// Une transaction PAR fable. IDEMPOTENT : une fable possédant déjà des blocs
// est ignorée. AUCUN exercice n'est recréé, AUCUN UUID n'est modifié,
// AUCUNE tentative n'est supprimée, AUCUNE notation n'est modifiée.
//
// Modes :
//   node scripts/migrer-blocs.mjs             → --dry-run (défaut)
//   node scripts/migrer-blocs.mjs --execute   → exécute la migration
//   node scripts/migrer-blocs.mjs --verify    → vérifie sans modifier
//   node scripts/migrer-blocs.mjs --rollback  → supprime les blocs migrés
// ---------------------------------------------------------------------------

import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const MODE = ["--execute", "--verify", "--rollback"].find((m) => process.argv.includes(m));

function anonyme(s, max = 70) {
  const brut = String(s ?? "").replace(/\s+/g, " ").trim();
  return brut.length > max ? `${brut.slice(0, max)}…` : brut || "(vide)";
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const fables = (
    await client.query(
      `SELECT id, titre, texte, image_url, audio_url, video_url FROM fables ORDER BY cree_le`
    )
  ).rows;

  console.log(`\n■ MODE : ${MODE ?? "--dry-run"} — ${fables.length} fable(s) analysée(s)\n`);

  // ----- ROLLBACK -----------------------------------------------------------
  if (MODE === "--rollback") {
    const avant = (await client.query("SELECT count(*)::int n FROM blocs_fable")).rows[0].n;
    await client.query("BEGIN");
    const r = await client.query(
      `DELETE FROM blocs_fable WHERE contenu->>'migre' = 'true' RETURNING id`
    );
    await client.query("COMMIT");
    console.log(`\nROLLBACK : ${r.rowCount} bloc(s) migré(s) supprimé(s) sur ${avant}.`);
    const base = await baseline(client);
    console.log(`BASELINE : ${base}`);
    await client.end();
    return;
  }

  const totalAttendu = { texte: 0, image: 0, audio: 0, video: 0, exercice: 0 };

  for (const f of fables) {
    const exos = (
      await client.query(
        `SELECT id, type, ordre, publie FROM exercices WHERE fable_id = $1 ORDER BY ordre, cree_le`,
        [f.id]
      )
    ).rows;

    // Calcul du parcours cible
    const parcours = [];
    if (String(f.texte ?? "").trim() !== "") {
      parcours.push({
        type: "texte",
        ordre: parcours.length,
        titre: "Texte de la fable",
        contenu: { markdown: f.texte, migre: "true" },
        exercice_id: null,
        visible: true,
      });
      totalAttendu.texte++;
    }
    if (String(f.image_url ?? "").trim() !== "") {
      parcours.push({
        type: "image",
        ordre: parcours.length,
        titre: "Illustration",
        contenu: {
          source: "url",
          url: f.image_url,
          alt: `Illustration de ${f.titre}`,
          legende: "",
          migre: "true",
        },
        exercice_id: null,
        visible: true,
      });
      totalAttendu.image++;
    }
    if (String(f.audio_url ?? "").trim() !== "") {
      parcours.push({
        type: "audio",
        ordre: parcours.length,
        titre: "Lecture audio",
        contenu: { source: "url", url: f.audio_url, titre: "Lecture audio", description: "", migre: "true" },
        exercice_id: null,
        visible: true,
      });
      totalAttendu.audio++;
    }
    if (String(f.video_url ?? "").trim() !== "") {
      parcours.push({
        type: "video",
        ordre: parcours.length,
        titre: "Vidéo",
        contenu: { source: "fichier", url: f.video_url, titre: "Vidéo", description: "", migre: "true" },
        exercice_id: null,
        visible: true,
      });
      totalAttendu.video++;
    }
    for (const e of exos) {
      parcours.push({
        type: "exercice",
        ordre: parcours.length,
        titre: "",
        contenu: { migre: "true" },
        exercice_id: e.id,
        visible: e.publie,
      });
      totalAttendu.exercice++;
    }

    const existants = (
      await client.query(`SELECT count(*)::int n FROM blocs_fable WHERE fable_id = $1`, [f.id])
    ).rows[0].n;

    console.log(`  ${f.titre}`);
    console.log(`    → ${parcours.length} bloc(s) cible(s) : texte=${parcours.filter(b=>b.type==='texte').length} image=${parcours.filter(b=>b.type==='image').length} audio=${parcours.filter(b=>b.type==='audio').length} video=${parcours.filter(b=>b.type==='video').length} exercice=${parcours.filter(b=>b.type==='exercice').length} | déjà présents : ${existants}`);

    if (MODE === "--verify") {
      if (existants !== parcours.length) {
        throw new Error(
          `ÉCHEC VERIFY « ${f.titre} » : ${existants} bloc(s) en base, ${parcours.length} attendu(s).`
        );
      }
      // Vérifie texte identique et références exercices.
      if (parcours.some((b) => b.type === "texte")) {
        const t = parcours.find((b) => b.type === "texte");
        const enB = (
          await client.query(
            `SELECT contenu->>'markdown' md FROM blocs_fable WHERE fable_id=$1 AND type='texte' ORDER BY ordre`,
            [f.id]
          )
        ).rows;
        const cible = String(t.contenu.markdown ?? "");
        const actuel = String(enB[0]?.md ?? "");
        if (actuel !== cible) {
          throw new Error(`ÉCHEC VERIFY « ${f.titre} » : le texte du bloc diffère du texte d'origine.`);
        }
      }
      const compteExos = Number(
        (await client.query(`SELECT count(*)::int n FROM blocs_fable WHERE fable_id=$1 AND type='exercice'`, [f.id])).rows[0].n
      );
      if (compteExos !== exos.length) {
        throw new Error(`ÉCHEC VERIFY « ${f.titre} » : ${compteExos} bloc(s) exercice, ${exos.length} attendu(s).`);
      }
      console.log(`    ✓ VERIFY OK (${existants} blocs, ${compteExos} exercices)`);
      continue;
    }

    if (MODE === "--execute") {
      if (existants > 0) {
        console.log(`    ↺ idempotence : ignorée (déjà ${existants} bloc(s)).`);
        continue;
      }
      await client.query("BEGIN");
      try {
        for (const b of parcours) {
          await client.query(
            `INSERT INTO blocs_fable (fable_id, type, ordre, titre, contenu, exercice_id, visible)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
            [
              f.id,
              b.type,
              b.ordre,
              b.titre,
              JSON.stringify(b.contenu),
              b.exercice_id,
              b.visible,
            ]
          );
        }
        // Invariant : ordres contigus 0..n-1 pour cette fable.
        const ordres = (
          await client.query(
            `SELECT ordre FROM blocs_fable WHERE fable_id=$1 ORDER BY ordre`,
            [f.id]
          )
        ).rows.map((r) => r.ordre);
        const contigu = ordres.every((o, i) => o === i);
        if (!contigu) {
          throw new Error(`Ordres non contigus pour « ${f.titre} » : ${ordres.join(",")}`);
        }
        await client.query("COMMIT");
        console.log(`    ✓ migrée (${parcours.length} blocs, ordres 0..${parcours.length - 1})`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  }

  // ----- Bilan --------------------------------------------------------------
  console.log(`\nTotal cible : texte=${totalAttendu.texte} image=${totalAttendu.image} audio=${totalAttendu.audio} video=${totalAttendu.video} exercice=${totalAttendu.exercice} → ${totalAttendu.texte + totalAttendu.image + totalAttendu.audio + totalAttendu.video + totalAttendu.exercice} blocs`);
  if (MODE === "--execute" || MODE === "--verify") {
    const nb = (await client.query("SELECT count(*)::int n FROM blocs_fable")).rows[0].n;
    console.log(`Blocs en base après opération : ${nb}`);
  }
  const base = await baseline(client);
  console.log(`BASELINE (doit être identique à l'audit) : ${base}`);

  await client.end();
}

async function baseline(client) {
  const r = (
    await client.query(
      `SELECT (SELECT count(*) FROM fables) fables,
              (SELECT count(*) FROM exercices) exercices,
              (SELECT count(*) FROM tentatives) tentatives,
              (SELECT round(avg(score)::numeric,2) FROM tentatives) score_moyen,
              (SELECT round(sum(score)::numeric,2) FROM tentatives) score_total,
              (SELECT sum(duree_secondes) FROM tentatives) duree,
              (SELECT count(*) FROM tentatives WHERE est_correct) reussies,
              (SELECT count(*) FROM tentatives WHERE est_correct IS NULL) en_attente`
    )
  ).rows[0];
  return `fables=${r.fables} exercices=${r.exercices} tentatives=${r.tentatives} score_moyen=${r.score_moyen} score_total=${r.score_total} duree=${r.duree} reussies=${r.reussies} en_attente=${r.en_attente}`;
}

main().catch((err) => {
  console.error("\n■ ÉCHEC :", err.message);
  process.exit(1);
});
