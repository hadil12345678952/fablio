import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { exercices, fables } from "@/db/schema";
import { enseignantConnecte, erreurJson, lireCorps } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// PUT /api/enseignant/fables/[id]/ordre-exercices — réordonnancement
export async function PUT(req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;

  const [fable] = await db
    .select()
    .from(fables)
    .where(and(eq(fables.id, id), eq(fables.enseignantId, auth.enseignant.id)))
    .limit(1);
  if (!fable) return erreurJson("Fable introuvable.", 404);

  const corps = await lireCorps(req);
  const ids = Array.isArray(corps?.ids)
    ? corps.ids.filter((x): x is string => typeof x === "string")
    : [];
  if (ids.length === 0) return erreurJson("Liste d'identifiants manquante.");

  const existants = await db
    .select({ id: exercices.id })
    .from(exercices)
    .where(eq(exercices.fableId, id));
  const appartiennent = new Set(existants.map((e) => e.id));
  if (ids.some((x) => !appartiennent.has(x)))
    return erreurJson("Un exercice ne appartient pas à cette fable.", 403);

  await Promise.all(
    ids.map((exoId, index) =>
      db.update(exercices).set({ ordre: index }).where(eq(exercices.id, exoId))
    )
  );
  return NextResponse.json({ ok: true });
}
