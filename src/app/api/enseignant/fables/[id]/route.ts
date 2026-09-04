import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { fables } from "@/db/schema";
import { enseignantConnecte, erreurJson, lireCorps } from "@/lib/api";
import { exercicesDeFable } from "@/lib/queries";
import { validerChampsFable } from "@/lib/validation";
import { validerFablePourPublication } from "@/lib/blocs/publication";

type Ctx = { params: Promise<{ id: string }> };

async function fablePossedee(id: string, enseignantId: string) {
  const [fable] = await db
    .select()
    .from(fables)
    .where(and(eq(fables.id, id), eq(fables.enseignantId, enseignantId)))
    .limit(1);
  return fable ?? null;
}

// GET /api/enseignant/fables/[id] — fable + exercices
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;
  const fable = await fablePossedee(id, auth.enseignant.id);
  if (!fable) return erreurJson("Fable introuvable.", 404);
  return NextResponse.json({ fable, exercices: await exercicesDeFable(id) });
}

// PUT /api/enseignant/fables/[id] — mise à jour
export async function PUT(req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;
  const fable = await fablePossedee(id, auth.enseignant.id);
  if (!fable) return erreurJson("Fable introuvable.", 404);

  const corps = await lireCorps(req);
  if (!corps) return erreurJson("Requête invalide.");

  // Bascule rapide de publication (sans revalider tout le formulaire)
  const clefs = Object.keys(corps);
  if (clefs.length === 1 && typeof corps.publie === "boolean") {
    // Validation des blocs avant publication (BROUILLON → PUBLIÉ).
    // La dépublication reste toujours autorisée sans validation.
    if (corps.publie === true) {
      const validation = await validerFablePourPublication(id, auth.enseignant.id);
      if (!validation.publiable) {
        return NextResponse.json(
          {
            erreur: "Impossible de publier : " + validation.erreurs[0],
            detailsValidation: validation.erreurs,
          },
          { status: 400 }
        );
      }
    }
    const [maj] = await db
      .update(fables)
      .set({ publie: corps.publie, modifieLe: new Date() })
      .where(eq(fables.id, id))
      .returning();
    return NextResponse.json({ ok: true, fable: maj });
  }

  const fusion = {
    titre: fable.titre,
    texte: fable.texte,
    morale: fable.morale,
    imageUrl: fable.imageUrl,
    audioUrl: fable.audioUrl,
    difficulte: fable.difficulte,
    publie: fable.publie,
    cibleCodeIds: fable.cibleCodeIds,
    ...corps,
  };
  const resultat = validerChampsFable(fusion);
  if (!resultat.ok) return erreurJson(resultat.erreur);

  const [maj] = await db
    .update(fables)
    .set({ ...resultat.donnees, modifieLe: new Date() })
    .where(eq(fables.id, id))
    .returning();
  return NextResponse.json({ ok: true, fable: maj });
}

// DELETE /api/enseignant/fables/[id]
export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;
  const fable = await fablePossedee(id, auth.enseignant.id);
  if (!fable) return erreurJson("Fable introuvable.", 404);
  await db.delete(fables).where(eq(fables.id, id));
  return NextResponse.json({ ok: true });
}
