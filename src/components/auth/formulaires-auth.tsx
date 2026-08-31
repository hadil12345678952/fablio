"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpenText,
  GraduationCap,
  SmilePlus,
  LoaderCircle,
  Info,
  KeyRound,
  Ticket,
  User,
} from "lucide-react";

type Role = "enseignant" | "eleve";

function SelecteurRole({
  role,
  onChange,
}: {
  role: Role;
  onChange: (r: Role) => void;
}) {
  return (
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
          onClick={() => onChange(valeur)}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition-all ${
            role === valeur
              ? "bg-encre text-papier shadow-carte"
              : "text-encre-doux hover:bg-encre/5"
          }`}
        >
          <Icone className="size-4.5" /> {label}
        </button>
      ))}
    </div>
  );
}

function MessageErreur({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-xl border-2 border-rose/30 bg-rose/10 px-4 py-2.5 text-sm font-bold text-rose">
      {message}
    </p>
  );
}

async function envoyer(url: string, donnees: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(donnees),
  });
  const json = (await res.json()) as { erreur?: string };
  if (!res.ok) throw new Error(json.erreur ?? "Une erreur est survenue.");
}

export function FormulaireConnexion({ roleInitial }: { roleInitial: Role }) {
  const [role, setRole] = useState<Role>(roleInitial);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const router = useRouter();

  const maj = (cle: string) => (e: { target: { value: string } }) =>
    setChamps((c) => ({ ...c, [cle]: e.target.value }));

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);
    try {
      if (role === "enseignant") {
        await envoyer("/api/auth/enseignant/connexion", {
          email: champs.email ?? "",
          motDePasse: champs.motDePasse ?? "",
        });
        router.push("/enseignant");
      } else {
        await envoyer("/api/auth/eleve/connexion", {
          pseudo: champs.pseudo ?? "",
          code: champs.code ?? "",
          pin: champs.pin ?? "",
        });
        router.push("/eleve");
      }
      router.refresh();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inattendue.");
      setChargement(false);
    }
  }

  return (
    <div className="carte w-full max-w-md p-7 sm:p-9">
      <SelecteurRole role={role} onChange={setRole} />
      <form onSubmit={soumettre} className="mt-6 space-y-4">
        {role === "enseignant" ? (
          <>
            <div>
              <label htmlFor="email" className="etiquette mb-1.5 block">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="champ"
                placeholder="prenom.nom@ecole.tn"
                onChange={maj("email")}
              />
            </div>
            <div>
              <label htmlFor="mdp" className="etiquette mb-1.5 block">
                Mot de passe
              </label>
              <input
                id="mdp"
                type="password"
                required
                autoComplete="current-password"
                className="champ"
                placeholder="********"
                onChange={maj("motDePasse")}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-2xl bg-sarcelle/10 px-4 py-3 text-sm font-bold text-sarcelle-fonce">
              <Info className="mt-0.5 size-5 shrink-0" />
              Utilise le code remis par ton enseignant et ton pseudo, choisis lors de ta première
              visite.
            </div>
            <div>
              <label htmlFor="code" className="etiquette mb-1.5 block">
                Code de la classe
              </label>
              <div className="relative">
                <Ticket className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-encre/30" />
                <input
                  id="code"
                  required
                  className="champ-eleve pl-12 tracking-widest uppercase"
                  placeholder="CE2A-X7K2Q"
                  onChange={maj("code")}
                />
              </div>
            </div>
            <div>
              <label htmlFor="pseudo" className="etiquette mb-1.5 block">
                Ton pseudo
              </label>
              <div className="relative">
                <User className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-encre/30" />
                <input
                  id="pseudo"
                  required
                  className="champ-eleve pl-12"
                  placeholder="samy_renard"
                  onChange={maj("pseudo")}
                />
              </div>
            </div>
            <div>
              <label htmlFor="pin" className="etiquette mb-1.5 block">
                Ton code secret
              </label>
              <div className="relative">
                <KeyRound className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-encre/30" />
                <input
                  id="pin"
                  type="password"
                  required
                  className="champ-eleve pl-12"
                  placeholder="4 chiffres"
                  onChange={maj("pin")}
                />
              </div>
            </div>
          </>
        )}
        <MessageErreur message={erreur} />
        <button type="submit" disabled={chargement} className="btn-primaire w-full py-3.5 text-base">
          {chargement ? (
            <>
              <LoaderCircle className="size-5 animate-spin" /> Connexion…
            </>
          ) : role === "enseignant" ? (
            "Accéder à mon tableau de bord"
          ) : (
            "Entrer dans ma classe"
          )}
        </button>
      </form>
      <p className="mt-6 text-center text-sm font-bold text-encre-doux">
        Pas encore de compte ?{" "}
        <Link
          href={role === "enseignant" ? "/inscription?role=enseignant" : "/inscription?role=eleve"}
          className="text-corail underline decoration-2 underline-offset-4 hover:text-corail-fonce"
        >
          S&apos;inscrire
        </Link>
      </p>
    </div>
  );
}

export function FormulaireInscription({ roleInitial }: { roleInitial: Role }) {
  const [role, setRole] = useState<Role>(roleInitial);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const router = useRouter();

  const maj = (cle: string) => (e: { target: { value: string } }) =>
    setChamps((c) => ({ ...c, [cle]: e.target.value }));

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);
    try {
      if (role === "enseignant") {
        await envoyer("/api/auth/enseignant/inscription", {
          nom: champs.nom ?? "",
          email: champs.email ?? "",
          motDePasse: champs.motDePasse ?? "",
        });
        router.push("/enseignant");
      } else {
        await envoyer("/api/auth/eleve/inscription", {
          pseudo: champs.pseudo ?? "",
          code: champs.code ?? "",
          pin: champs.pin ?? "",
        });
        router.push("/eleve");
      }
      router.refresh();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inattendue.");
      setChargement(false);
    }
  }

  return (
    <div className="carte w-full max-w-md p-7 sm:p-9">
      <SelecteurRole role={role} onChange={setRole} />
      <form onSubmit={soumettre} className="mt-6 space-y-4">
        {role === "enseignant" ? (
          <>
            <div>
              <label htmlFor="nom" className="etiquette mb-1.5 block">
                Nom complet
              </label>
              <input
                id="nom"
                required
                className="champ"
                placeholder="Mme Amira Ben Salah"
                onChange={maj("nom")}
              />
            </div>
            <div>
              <label htmlFor="email" className="etiquette mb-1.5 block">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="champ"
                placeholder="prenom.nom@ecole.tn"
                onChange={maj("email")}
              />
            </div>
            <div>
              <label htmlFor="mdp" className="etiquette mb-1.5 block">
                Mot de passe (8 caractères min.)
              </label>
              <input
                id="mdp"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="champ"
                placeholder="********"
                onChange={maj("motDePasse")}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-2xl bg-sarcelle/10 px-4 py-3 text-sm font-bold text-sarcelle-fonce">
              <Info className="mt-0.5 size-5 shrink-0" />
              Demande le <span className="underline">code de ta classe</span> à ton enseignant,
              choisis un pseudo et un code secret à retenir.
            </div>
            <div>
              <label htmlFor="code" className="etiquette mb-1.5 block">
                Code de la classe
              </label>
              <div className="relative">
                <Ticket className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-encre/30" />
                <input
                  id="code"
                  required
                  className="champ-eleve pl-12 tracking-widest uppercase"
                  placeholder="CE2A-X7K2Q"
                  onChange={maj("code")}
                />
              </div>
            </div>
            <div>
              <label htmlFor="pseudo" className="etiquette mb-1.5 block">
                Choisis ton pseudo
              </label>
              <div className="relative">
                <User className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-encre/30" />
                <input
                  id="pseudo"
                  required
                  className="champ-eleve pl-12"
                  placeholder="lina_tortue"
                  onChange={maj("pseudo")}
                />
              </div>
            </div>
            <div>
              <label htmlFor="pin" className="etiquette mb-1.5 block">
                Choisis un code secret (4 chiffres, par ex.)
              </label>
              <div className="relative">
                <KeyRound className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-encre/30" />
                <input
                  id="pin"
                  type="password"
                  required
                  minLength={4}
                  className="champ-eleve pl-12"
                  placeholder="Garde-le pour toi !"
                  onChange={maj("pin")}
                />
              </div>
            </div>
          </>
        )}
        <MessageErreur message={erreur} />
        <button type="submit" disabled={chargement} className="btn-primaire w-full py-3.5 text-base">
          {chargement ? (
            <>
              <LoaderCircle className="size-5 animate-spin" /> Création du compte…
            </>
          ) : role === "enseignant" ? (
            "Créer mon espace enseignant"
          ) : (
            "Rejoindre ma classe"
          )}
        </button>
      </form>
      <p className="mt-6 text-center text-sm font-bold text-encre-doux">
        Déjà inscrit ?{" "}
        <Link
          href={role === "enseignant" ? "/connexion?role=enseignant" : "/connexion?role=eleve"}
          className="text-corail underline decoration-2 underline-offset-4 hover:text-corail-fonce"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}

/** Cadre commun des pages d'authentification. */
export function CadreAuth({
  titre,
  sousTitre,
  children,
}: {
  titre: string;
  sousTitre: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-points flex min-h-dvh flex-col items-center px-5 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <span className="grid size-11 place-items-center rounded-2xl bg-corail text-white shadow-carte">
          <BookOpenText className="size-5.5" strokeWidth={2.4} />
        </span>
        <span className="font-titre text-3xl font-bold">Fablio</span>
      </Link>
      <div className="mb-6 max-w-md text-center">
        <h1 className="font-titre text-3xl font-bold tracking-tight">{titre}</h1>
        <p className="mt-2 font-semibold text-encre-doux">{sousTitre}</p>
      </div>
      {children}
    </div>
  );
}
