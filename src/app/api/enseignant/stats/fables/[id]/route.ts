import { NextResponse } from "next/server";
import { enseignantConnecte, erreurJson } from "@/lib/api";
import { statsFable } from "@/lib/statistiques";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/enseignant/stats/fables/[id]
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await enseignantConnecte();
  if ("echec" in auth) return auth.echec;
  const { id } = await ctx.params;
  const stats = await statsFable(auth.enseignant.id, id);
  if (!stats) return erreurJson("Fable introuvable.", 404);
  return NextResponse.json({ stats });
}
