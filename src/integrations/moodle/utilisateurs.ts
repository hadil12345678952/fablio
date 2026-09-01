import "server-only";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { liensMoodleUtilisateurs } from "@/db/schema";
import { appelerMoodle, ErreurMoodle } from "./client";
import type { IdentitePlateforme, RechercheUtilisateurs } from "./types";

// ---------------------------------------------------------------------------
// Synchronisation des utilisateurs (Phase 5) — IDEMPOTENTE :
//
//   1. mapping local existant         → on renvoie l'id Moodle (aucun doublon)
//   2. compte Moodle portant le même email → on se RATTACHE (pas de doublon)
//   3. sinon                          → création du compte Moodle
//
// Stratégie email :
//   - enseignant → son email réel ;
//   - élève (pas d'email sur la plateforme) → adresse technique unique
//     <pseudo>.<id8>@eleves.fablio.local (documentée : ne reçoit aucun courriel).
// ---------------------------------------------------------------------------

export interface ResultatAssurerUtilisateur {
  moodleUserId: number;
  nouveauCompte: boolean;
}

function emailPour(identite: IdentitePlateforme): string {
  if (identite.type === "enseignant") return identite.email;
  const pseudoNet = identite.email
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24) || "eleve";
  return `${pseudoNet}.${identite.id.replace(/-/g, "").slice(0, 8)}@eleves.fablio.local`;
}

export async function assurerUtilisateurMoodle(
  identite: IdentitePlateforme
): Promise<ResultatAssurerUtilisateur> {
  // 1. Mapping local ?
  const [lien] = await db
    .select()
    .from(liensMoodleUtilisateurs)
    .where(
      and(
        eq(liensMoodleUtilisateurs.typeUtilisateur, identite.type),
        eq(liensMoodleUtilisateurs.utilisateurId, identite.id)
      )
    )
    .limit(1);
  if (lien) return { moodleUserId: lien.moodleUserId, nouveauCompte: false };

  const email = emailPour(identite);

  // 2. Compte Moodle existant avec ce courriel ? → rattachement
  try {
    const recherche = await appelerMoodle<RechercheUtilisateurs>("core_user_get_users", {
      criteria: [{ key: "email", value: email }],
    });
    const trouve = recherche.users?.[0];
    if (trouve?.id) {
      await db.insert(liensMoodleUtilisateurs).values({
        typeUtilisateur: identite.type,
        utilisateurId: identite.id,
        moodleUserId: trouve.id,
        identifiantMoodle: trouve.username ?? "",
      });
      return { moodleUserId: trouve.id, nouveauCompte: false };
    }
  } catch {
    // On tentera la création.
  }

  // 3. Création du compte Moodle.
  const username = (identite.type === "enseignant" ? "fablioens" : "fablioelev")
    .concat(identite.id.replace(/-/g, ""))
    .slice(0, 90);
  const motDePasse = `Fb!${crypto.randomBytes(9).toString("hex")}1a`;

  const cree = await appelerMoodle<{ id: number; username: string }[]>(
    "core_user_create_users",
    {
      users: [
        {
          username,
          password: motDePasse,
          firstname: identite.prenom || "Prénom",
          lastname: identite.nom || identite.type,
          email,
          city: "Tunis",
          country: "TN",
          auth: "manual",
        },
      ],
    }
  );
  const moodleUserId = cree?.[0]?.id;
  if (!moodleUserId)
    throw new ErreurMoodle("Moodle n'a pas renvoyé d'identifiant de compte.");

  await db.insert(liensMoodleUtilisateurs).values({
    typeUtilisateur: identite.type,
    utilisateurId: identite.id,
    moodleUserId,
    identifiantMoodle: cree[0].username ?? username,
  });
  return { moodleUserId, nouveauCompte: true };
}
