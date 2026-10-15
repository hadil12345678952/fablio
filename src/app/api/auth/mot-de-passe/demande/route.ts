import { NextResponse } from "next/server";
import { erreurJson, lireCorps, chaine, originePublique } from "@/lib/api";
import { creerDemandeReinitialisation } from "@/lib/recuperation";
import { envoyerCourriel } from "@/lib/courriel";

// POST /api/auth/mot-de-passe/demande  { email }
//
// Réponse TOUJOURS identique (succès) afin de ne jamais révéler si un compte
// existe. Le lien part par courriel s'il est configuré, sinon il est journalisé
// côté serveur — jamais renvoyé au navigateur.
export async function POST(req: Request) {
  const corps = await lireCorps(req);
  if (!corps) return erreurJson("Requête invalide.");

  const email = chaine(corps.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return erreurJson("Adresse email invalide.");

  const demande = await creerDemandeReinitialisation(email);

  if (demande) {
    // Origine publique : NEXT_PUBLIC_URL_SITE de préférence (voir originePublique).
    const base = originePublique(req);
    const lien = `${base}/mot-de-passe/reinitialiser?jeton=${encodeURIComponent(demande.jeton)}`;
    const envoi = await envoyerCourriel({
      destinataire: email,
      sujet: "Fablio — réinitialisation de votre mot de passe",
      texte:
        `Bonjour,\n\n` +
        `Vous avez demandé à réinitialiser votre mot de passe Fablio.\n` +
        `Ouvrez ce lien (valable 1 heure, à usage unique) :\n\n${lien}\n\n` +
        `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : ` +
        `votre mot de passe actuel reste valable.\n\n— Fablio`,
    });
    // Trace exploitable par l'administration : ni le jeton ni le lien ne sont
    // renvoyés au navigateur (voir la réponse neutre plus bas).
    console.info(
      `[fablio:recuperation] demande traitée — livraison=${envoi.statut} destinataire=${email} détail=${envoi.detail}`
    );
  }

  // Message unique : ni confirmation ni infirmation de l'existence du compte.
  return NextResponse.json({
    ok: true,
    message:
      "Si un compte existe avec cette adresse, un lien de réinitialisation vient d'être envoyé. Pensez à vérifier vos courriers indésirables.",
  });
}
