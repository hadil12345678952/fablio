"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LoaderCircle,
  Mail,
  CheckCircle2,
  TriangleAlert,
  KeyRound,
  GraduationCap,
  SmilePlus,
  Info,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Deux parcours distincts, adaptés à la gestion des comptes de la plateforme :
//   • Enseignant : compte avec email → lien de réinitialisation à usage unique.
//   • Élève      : pas d'email → l'enseignant réinitialise le code secret
//                  depuis la fiche élève (mécanisme existant, sécurisé).
// ---------------------------------------------------------------------------

export function FormulaireMotDePasseOublie() {
  const [role, setRole] = useState<"enseignant" | "eleve">("enseignant");
  const [email, setEmail] = useState("");
  const [etat, setEtat] = useState<"repos" | "envoi" | "envoye">("repos");
  const [message, setMessage] = useState<string | null>(null);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setEtat("envoi");
    try {
      const res = await fetch("/api/auth/mot-de-passe/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as { message?: string; erreur?: string };
      if (!res.ok) {
        setMessage(json.erreur ?? "Une erreur est survenue.");
        setEtat("repos");
        return;
      }
      setMessage(json.message ?? null);
      setEtat("envoye");
    } catch {
      setMessage("Connexion impossible. Réessayez dans un instant.");
      setEtat("repos");
    }
  }

  return (
    <div className="carte w-full max-w-md p-7 sm:p-9">
      {/* Sélecteur de rôle */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border-2 border-encre/10 bg-papier p-1.5">
        {(
          [
            ["enseignant", "Enseignant", GraduationCap],
            ["eleve", "Élève", SmilePlus],
          ] as const
        ).map(([valeur, label, Icone]) => (
          <button
            key={valeur}
            type="button"
            onClick={() => setRole(valeur)}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition-all ${
              role === valeur ? "bg-encre text-papier shadow-carte" : "text-encre-doux hover:bg-encre/5"
            }`}
          >
            <Icone className="size-4.5" /> {label}
          </button>
        ))}
      </div>

      {role === "enseignant" ? (
        etat === "envoye" ? (
          <div className="anim-apparition mt-6 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-menthe/15 text-menthe-fonce">
              <CheckCircle2 className="size-7" />
            </span>
            <p className="font-titre mt-4 text-xl font-bold">Demande enregistrée</p>
            <p className="mt-2 font-semibold text-encre-doux">{message}</p>
            <p className="mt-3 text-sm font-semibold text-encre/50">
              Le lien est valable <strong>1 heure</strong> et ne peut servir qu&apos;une fois.
            </p>
            <Link href="/connexion?role=enseignant" className="btn-primaire mt-6 w-full">
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={soumettre} className="mt-6 space-y-4">
            <p className="font-semibold text-encre-doux">
              Indiquez l&apos;adresse email de votre compte : nous vous enverrons un lien
              sécurisé pour choisir un nouveau mot de passe.
            </p>
            <div>
              <label htmlFor="email" className="etiquette mb-1.5 block">
                Adresse email
              </label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-encre/30" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom.nom@ecole.tn"
                  className="champ pl-12"
                />
              </div>
            </div>
            {message && (
              <p className="rounded-xl border-2 border-rose/30 bg-rose/10 px-4 py-2.5 text-sm font-bold text-rose">
                {message}
              </p>
            )}
            <button type="submit" disabled={etat === "envoi"} className="btn-primaire w-full py-3.5 text-base">
              {etat === "envoi" ? (
                <>
                  <LoaderCircle className="size-5 animate-spin" /> Envoi en cours…
                </>
              ) : (
                "Recevoir le lien de réinitialisation"
              )}
            </button>
          </form>
        )
      ) : (
        <div className="anim-apparition mt-6">
          <div className="flex items-start gap-3 rounded-2xl bg-azur/10 px-4 py-3.5 text-sm font-bold text-azur-fonce">
            <Info className="mt-0.5 size-5 shrink-0" />
            Pas d&apos;inquiétude : ton code secret peut être remis à zéro par ton enseignant.
          </div>
          <ol className="mt-5 space-y-3">
            {[
              "Préviens ton enseignant que tu as oublié ton code secret.",
              "Il ouvre ta fiche dans « Mes élèves » et choisit un nouveau code.",
              "Il te donne ce nouveau code : tu peux te reconnecter aussitôt.",
            ].map((etape, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-titre grid size-8 shrink-0 place-items-center rounded-xl bg-rose text-sm font-bold text-white">
                  {i + 1}
                </span>
                <p className="pt-1 font-semibold text-encre-doux">{etape}</p>
              </li>
            ))}
          </ol>
          <p className="mt-5 rounded-2xl bg-papier px-4 py-3 text-sm font-semibold text-encre/55">
            Ton pseudo et le code de ta classe restent les mêmes. Personne d&apos;autre que ton
            enseignant ne peut modifier ton compte.
          </p>
          <Link href="/connexion?role=eleve" className="btn-primaire mt-5 w-full py-3.5 text-base">
            Retour à la connexion
          </Link>
        </div>
      )}

      <p className="mt-6 text-center text-sm font-bold text-encre-doux">
        <Link
          href="/connexion"
          className="text-rose underline decoration-2 underline-offset-4 hover:text-rose-fonce"
        >
          Revenir à la page de connexion
        </Link>
      </p>
    </div>
  );
}

export function FormulaireReinitialisation() {
  const params = useSearchParams();
  const jeton = params.get("jeton") ?? "";
  const router = useRouter();

  const [verif, setVerif] = useState<
    { etat: "chargement" } | { etat: "ok"; email: string } | { etat: "ko"; raison: string }
  >({ etat: "chargement" });
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState(false);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/auth/mot-de-passe/reinitialiser?jeton=${encodeURIComponent(jeton)}`
        );
        const json = (await res.json()) as {
          valide: boolean;
          email?: string;
          raison?: string;
        };
        if (annule) return;
        setVerif(
          json.valide
            ? { etat: "ok", email: json.email ?? "" }
            : { etat: "ko", raison: json.raison ?? "Lien invalide." }
        );
      } catch {
        if (!annule) setVerif({ etat: "ko", raison: "Vérification impossible." });
      }
    })();
    return () => {
      annule = true;
    };
  }, [jeton]);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (mdp !== confirmation) {
      setErreur("Les deux mots de passe ne sont pas identiques.");
      return;
    }
    setEnvoi(true);
    try {
      const res = await fetch("/api/auth/mot-de-passe/reinitialiser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jeton, motDePasse: mdp }),
      });
      const json = (await res.json()) as { erreur?: string };
      if (!res.ok) {
        setErreur(json.erreur ?? "Une erreur est survenue.");
        setEnvoi(false);
        return;
      }
      setFini(true);
      setTimeout(() => router.push("/connexion?role=enseignant"), 2200);
    } catch {
      setErreur("Connexion impossible. Réessayez.");
      setEnvoi(false);
    }
  }

  if (verif.etat === "chargement") {
    return (
      <div className="carte w-full max-w-md p-9 text-center">
        <LoaderCircle className="mx-auto size-8 animate-spin text-rose" />
        <p className="mt-3 font-semibold text-encre-doux">Vérification du lien…</p>
      </div>
    );
  }

  if (verif.etat === "ko") {
    return (
      <div className="carte w-full max-w-md p-7 text-center sm:p-9">
        <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-ambre/15 text-ambre-fonce">
          <TriangleAlert className="size-7" />
        </span>
        <p className="font-titre mt-4 text-xl font-bold">Lien inutilisable</p>
        <p className="mt-2 font-semibold text-encre-doux">{verif.raison}</p>
        <Link href="/mot-de-passe/oublie" className="btn-primaire mt-6 w-full">
          Demander un nouveau lien
        </Link>
        <Link href="/connexion" className="btn-fantome mt-2 w-full">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  if (fini) {
    return (
      <div className="carte anim-apparition w-full max-w-md p-9 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-menthe/15 text-menthe-fonce">
          <CheckCircle2 className="size-7" />
        </span>
        <p className="font-titre mt-4 text-xl font-bold">Mot de passe modifié</p>
        <p className="mt-2 font-semibold text-encre-doux">
          Vous allez être redirigé vers la page de connexion…
        </p>
      </div>
    );
  }

  return (
    <div className="carte w-full max-w-md p-7 sm:p-9">
      <p className="font-semibold text-encre-doux">
        Nouveau mot de passe pour <strong>{verif.email}</strong>.
      </p>
      <form onSubmit={soumettre} className="mt-5 space-y-4">
        <div>
          <label htmlFor="mdp" className="etiquette mb-1.5 block">
            Nouveau mot de passe (8 caractères min.)
          </label>
          <div className="relative">
            <KeyRound className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-encre/30" />
            <input
              id="mdp"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={mdp}
              onChange={(e) => setMdp(e.target.value)}
              className="champ pl-12"
              placeholder="********"
            />
          </div>
        </div>
        <div>
          <label htmlFor="confirmation" className="etiquette mb-1.5 block">
            Confirmer le mot de passe
          </label>
          <input
            id="confirmation"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="champ"
            placeholder="********"
          />
        </div>
        {erreur && (
          <p className="rounded-xl border-2 border-rose/30 bg-rose/10 px-4 py-2.5 text-sm font-bold text-rose">
            {erreur}
          </p>
        )}
        <p className="text-xs font-semibold text-encre/50">
          Par sécurité, toutes vos sessions ouvertes seront fermées après la modification.
        </p>
        <button type="submit" disabled={envoi} className="btn-primaire w-full py-3.5 text-base">
          {envoi ? (
            <>
              <LoaderCircle className="size-5 animate-spin" /> Enregistrement…
            </>
          ) : (
            "Choisir ce mot de passe"
          )}
        </button>
      </form>
    </div>
  );
}
