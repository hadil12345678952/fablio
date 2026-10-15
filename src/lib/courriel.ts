import "server-only";

// ---------------------------------------------------------------------------
// Envoi de courriel — sans dépendance (API Resend par simple appel HTTP).
//
// CORRECTIF (2026-10) — « le mail de récupération n'arrive jamais ».
// Trois causes étaient possibles et aucune n'était visible :
//   1. RESEND_API_KEY absente : le message était journalisé, mais l'écran
//      annonçait quand même « un lien vient d'être envoyé » ;
//   2. expéditeur par défaut « onboarding@resend.dev » : Resend REFUSE
//      silencieusement toute adresse autre que celle du titulaire du compte
//      (adresse de test) → erreur 403 côté API, invisible pour l'utilisateur ;
//   3. au moindre échec, le lien de réinitialisation était PERDU (seul un
//      « échec Resend 403 » était journalisé) : impossible de récupérer le
//      compte sans attendre le rétablissement du quota.
//
// Désormais :
//   • le résultat de l'envoi est structuré (statut + raison lisible) ;
//   • un échec réessaie une fois (réseau / 5xx / 429), avec une clé
//     d'idempotence pour ne jamais envoyer deux fois le même message ;
//   • en cas d'échec, le message ENTIER (donc le lien) est journalisé côté
//     serveur, précédé d'un marqueur explicite : l'administrateur peut
//     transmettre le lien à l'enseignant, et le compte reste récupérable ;
//   • une configuration problématique est signalée au démarrage de l'appel
//     (expéditeur de test « resend.dev », expéditeur sans « @ »).
//
// Le jeton n'est JAMAIS renvoyé au navigateur (voir la route de demande).
// ---------------------------------------------------------------------------

export interface Courriel {
  destinataire: string;
  sujet: string;
  texte: string;
}

export type StatutEnvoi = "envoye" | "journalise" | "echec";

export interface ResultatEnvoi {
  statut: StatutEnvoi;
  /** Explication lisible de ce qui s'est passé (jamais de secret dedans). */
  detail: string;
  /** Identifiant du message renvoyé par Resend quand il a été accepté. */
  identifiant?: string;
}

/** Expéditeur de test imposé par Resend quand rien n'est configuré. */
const EXPEDITEUR_PAR_DEFAUT = "Fablio <onboarding@resend.dev>";

/** Nombre total de tentatives (1 essai + 1 nouvel essai sur incident). */
const TENTATIVES = 2;

/** État de la configuration de courriel (diagnostic, aucune donnée secrète). */
export function etatCourriel(): {
  transport: "resend" | "journal";
  expediteur: string | null;
  avertissements: string[];
} {
  const cle = process.env.RESEND_API_KEY?.trim();
  const expediteur = process.env.COURRIEL_EXPEDITEUR?.trim() || EXPEDITEUR_PAR_DEFAUT;
  const avertissements: string[] = [];

  if (!cle) {
    avertissements.push(
      "RESEND_API_KEY absente : les messages sont journalisés sur le serveur, aucun courriel n'est envoyé."
    );
  } else if (/@resend\.dev>?\s*$/i.test(expediteur) || expediteur.includes("onboarding@resend.dev")) {
    avertissements.push(
      "COURRIEL_EXPEDITEUR utilise l'adresse de test « onboarding@resend.dev » : Resend n'accepte alors comme destinataire QUE l'adresse du titulaire du compte Resend. Vérifiez un domaine dans Resend et définissez COURRIEL_EXPEDITEUR (ex. « Fablio <no-reply@votre-domaine.tn> »)."
    );
  }
  if (!expediteur.includes("@")) {
    avertissements.push(
      "COURRIEL_EXPEDITEUR ne contient pas d'adresse email valide : l'envoi sera refusé par Resend (erreur 422)."
    );
  }
  return { transport: cle ? "resend" : "journal", expediteur, avertissements };
}

/** Journalise le message complet (dernier recours : le lien reste récupérable). */
function journaliser(prefixe: string, m: Courriel, detail: string): void {
  console.warn(
    `[fablio:courriel] ${prefixe}\n` +
      `  Raison  : ${detail}\n` +
      `  À       : ${m.destinataire}\n` +
      `  Sujet   : ${m.sujet}\n` +
      `  Message (à transmettre manuellement si nécessaire) :\n${m.texte}\n`
  );
}

/**
 * Envoie un courriel. Ne lève jamais : dans le pire des cas le message est
 * journalisé et le statut vaut « echec » (l'appelant reste maître de sa réponse
 * HTTP, qui doit rester neutre pour ne pas révéler l'existence du compte).
 */
export async function envoyerCourriel(m: Courriel): Promise<ResultatEnvoi> {
  const { transport, expediteur, avertissements } = etatCourriel();

  if (transport === "journal") {
    journaliser("(non configuré — journalisé)", m, avertissements[0] ?? "RESEND_API_KEY absente");
    return { statut: "journalise", detail: avertissements[0] ?? "RESEND_API_KEY absente" };
  }

  for (const a of avertissements) console.warn(`[fablio:courriel] ⚠ ${a}`);

  // Même clé d'idempotence pour toutes les tentatives : Resend ne créera jamais
  // deux messages identiques si la première requête a abouti côté serveur.
  const cleIdempotence = crypto.randomUUID();
  let dernierDetail = "";

  for (let tentative = 1; tentative <= TENTATIVES; tentative++) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
          "Content-Type": "application/json",
          "Idempotency-Key": cleIdempotence,
        },
        body: JSON.stringify({
          from: expediteur,
          to: [m.destinataire],
          subject: m.sujet,
          text: m.texte,
        }),
      });

      if (res.ok) {
        let identifiant: string | undefined;
        try {
          const corps = (await res.json()) as { id?: string };
          identifiant = corps?.id;
        } catch {
          /* réponse sans corps JSON : l'essentiel est le code 2xx */
        }
        console.info(
          `[fablio:courriel] statut=envoye transport=resend id=${identifiant ?? "?"} destinataire=${m.destinataire}`
        );
        return {
          statut: "envoye",
          detail: "Message accepté par Resend.",
          identifiant,
        };
      }

      const corpsErreur = (await res.text().catch(() => "")).slice(0, 500);
      dernierDetail = `Resend ${res.status} ${corpsErreur}`;
      const definitif = res.status < 500 && res.status !== 429;
      console.error(`[fablio:courriel] tentative ${tentative}/${TENTATIVES} échouée — ${dernierDetail}`);
      if (definitif) break; // 401/403/422 : inutile d'insister
    } catch (e) {
      dernierDetail = `erreur réseau : ${e instanceof Error ? e.message : String(e)}`;
      console.error(`[fablio:courriel] tentative ${tentative}/${TENTATIVES} échouée — ${dernierDetail}`);
    }

    if (tentative < TENTATIVES) await new Promise((r) => setTimeout(r, 600));
  }

  if (avertissements.length > 0) dernierDetail += ` | ${avertissements.join(" ")}`;
  journaliser("⚠ ÉCHEC D'ENVOI — message journalisé pour transmission manuelle", m, dernierDetail);
  return { statut: "echec", detail: dernierDetail };
}
