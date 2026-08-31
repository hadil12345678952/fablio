import { NextResponse } from "next/server";
import { lireSession } from "@/lib/auth";

export async function GET() {
  const session = await lireSession();
  if (!session) return NextResponse.json({ session: null });
  if (session.type === "enseignant") {
    return NextResponse.json({
      session: {
        type: "enseignant",
        nom: session.enseignant.nom,
        email: session.enseignant.email,
      },
    });
  }
  return NextResponse.json({
    session: { type: "eleve", pseudo: session.eleve.pseudo },
  });
}
