import "server-only";

// ---------------------------------------------------------------------------
// Envoi de courriel — optionnel et sans dépendance.
//
// Si RESEND_API_KEY est défini, le message part réellement (API Resend, simple
// appel HTTP). Sinon, le message est écrit dans les JOURNAUX DU SERVEUR
// (jamais renvoyé au navigateur) : l'administrateur de l'établissement peut
// alors transmettre le lien à l'enseignant. Aucune fuite côté client.
// ---------------------------------------------------------------------------

export interface Courriel {
  destinataire: string;
  sujet: string;
  texte: string;
}

export type ResultatEnvoi = "envoye" | "journalise" | "echec";

export async function envoyerCourriel(m: Courriel): Promise<ResultatEnvoi> {
  const cle = process.env.RESEND_API_KEY?.trim();
  const expediteur =
    process.env.COURRIEL_EXPEDITEUR?.trim() || "Fablio <onboarding@resend.dev>";

  if (!cle) {
    console.info(
      `[fablio:courriel] (non configuré — journalisé)\n` +
        `  À      : ${m.destinataire}\n` +
        `  Sujet  : ${m.sujet}\n` +
        `  Message:\n${m.texte}\n`
    );
    return "journalise";
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cle}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: expediteur,
        to: [m.destinataire],
        subject: m.sujet,
        text: m.texte,
      }),
    });
    if (!res.ok) {
      console.error("[fablio:courriel] échec Resend", res.status, await res.text());
      return "echec";
    }
    return "envoye";
  } catch (e) {
    console.error("[fablio:courriel] erreur réseau", e);
    return "echec";
  }
}
