import { NextResponse } from "next/server";
import { enseignantConnecte, erreurJson } from "@/lib/api";
import {
  ErreurMoodle,
  MoodleIndisponible,
  moodleConfigure,
  trouverCoursDuQuiz,
} from "@/integrations/moodle";
import { tentativesDepuisMoodle } from "@/integrations/moodle/quiz";
import { journaliserMoodle } from "@/integrations/moodle/journal";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/integrations/moodle/quiz/[id]/tentatives?cours=123 (facultatif)
// Récupère les tentatives d'un quiz Moodle pour le panneau de statistiques.
export async function GET(req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  if (!moodleConfigure())
    return erreurJson("Le service d'évaluation (Moodle) n'est pas configuré.", 503);

  const { id } = await ctx.params;
  const quizId = Number(id);
  if (!Number.isInteger(quizId) || quizId <= 0) return erreurJson("Quiz Moodle invalide.");

  const url = new URL(req.url);
  const coursParam = Number(url.searchParams.get("cours"));
  try {
    const coursMoodleId =
      Number.isInteger(coursParam) && coursParam > 0
        ? coursParam
        : await trouverCoursDuQuiz(auth.enseignant.id, quizId);
    if (!coursMoodleId)
      return erreurJson(
        "Ce quiz n'appartient à aucun cours Moodle lié à vos classes. Synchronisez d'abord vos cours.",
        404
      );
    const panier = await tentativesDepuisMoodle(coursMoodleId, quizId);
    await journaliserMoodle(
      "quiz",
      "ok",
      `Consultation des tentatives du quiz « ${panier.quiz.nom} ».`
    );
    return NextResponse.json({ panier });
  } catch (e) {
    const message =
      e instanceof MoodleIndisponible
        ? "Le service d'évaluation est temporairement indisponible. Veuillez réessayer dans quelques instants."
        : e instanceof ErreurMoodle
          ? e.message
          : "Impossible de joindre Moodle.";
    await journaliserMoodle("quiz", "erreur", message);
    return erreurJson(message, 502);
  }
}
