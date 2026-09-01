import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { exercices } from "@/db/schema";
import { enseignantConnecte, erreurJson, lireCorps, chaine } from "@/lib/api";
import { moodleConfigure, MoodleIndisponible, ErreurMoodle } from "@/integrations/moodle";
import { creerActiviteMoodle } from "@/integrations/moodle/creation";
import { journaliserMoodle } from "@/integrations/moodle/journal";

// POST /api/integrations/moodle/activite  { exerciceId }
// Crée automatiquement le quiz Moodle correspondant à l'exercice Fablio.
export async function POST(req: Request) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  if (!moodleConfigure())
    return erreurJson(
      "Le service d'évaluation (Moodle) n'est pas configuré : ajoutez MOODLE_URL et MOODLE_TOKEN, puis installez le plugin local_fablio.",
      503
    );

  const corps = await lireCorps(req);
  const exerciceId = chaine(corps?.exerciceId);
  const [exercice] = await db
    .select()
    .from(exercices)
    .where(and(eq(exercices.id, exerciceId), eq(exercices.publie, true)))
    .limit(1);
  if (!exercice) return erreurJson("Exercice introuvable.", 404);

  try {
    const resultat = await creerActiviteMoodle(auth.enseignant, exercice);
    if (!resultat.mappable)
      return NextResponse.json({ resultat, cree: false });
    return NextResponse.json({ resultat, cree: true });
  } catch (e) {
    const message =
      e instanceof MoodleIndisponible
        ? "Le service d'évaluation est temporairement indisponible. Veuillez réessayer dans quelques instants."
        : e instanceof ErreurMoodle
          ? e.message
          : "Création de l'activité impossible.";
    await journaliserMoodle("quiz", "erreur", message);
    return erreurJson(message, 502);
  }
}
