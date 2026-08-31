import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  BookOpenText,
  ListChecks,
  MousePointerClick,
  Plus,
  Ticket,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Hourglass,
  Sparkles,
} from "lucide-react";
import { lireSession } from "@/lib/auth";
import { syntheseEnseignant } from "@/lib/statistiques";
import { CourbeActivite, BarresFables } from "@/components/graphiques";
import { formatScore, formatPct } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function PageTableauDeBord() {
  const session = await lireSession();
  if (!session || session.type !== "enseignant") redirect("/connexion?role=enseignant");
  const s = await syntheseEnseignant(session.enseignant.id);

  const cartes = [
    { label: "Élèves inscrits", valeur: s.nbEleves, icone: Users, style: "bg-sarcelle/12 text-sarcelle" },
    { label: "Fables créées", valeur: s.nbFables, icone: BookOpenText, style: "bg-corail/12 text-corail" },
    { label: "Exercices", valeur: s.nbExercices, icone: ListChecks, style: "bg-lilas/12 text-lilas" },
    { label: "Tentatives", valeur: s.nbTentatives, icone: MousePointerClick, style: "bg-ambre/15 text-ambre-fonce" },
  ];

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="etiquette text-corail">Tableau de bord</p>
          <h1 className="font-titre mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            Bonjour, {session.enseignant.nom.split(" ")[0]}
          </h1>
          <p className="mt-1.5 font-semibold text-encre-doux">
            Voici l&apos;activité de votre classe en un coup d&apos;œil.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/enseignant/codes" className="btn-ligne">
            <Ticket className="size-4.5" /> Nouveau code
          </Link>
          <Link href="/enseignant/fables/nouvelle" className="btn-primaire">
            <Plus className="size-4.5" /> Nouvelle fable
          </Link>
        </div>
      </div>

      {/* Cartes chiffres */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cartes.map((c) => (
          <div key={c.label} className="carte p-5">
            <span className={`grid size-11 place-items-center rounded-2xl ${c.style}`}>
              <c.icone className="size-5.5" />
            </span>
            <p className="font-titre mt-3 text-3xl font-bold">{c.valeur}</p>
            <p className="text-sm font-bold text-encre/50">{c.label}</p>
          </div>
        ))}
      </div>

      {s.nbFables === 0 ? (
        <div className="carte bg-points flex flex-col items-center px-8 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-3xl bg-corail/12 text-corail">
            <Sparkles className="size-8" />
          </span>
          <h2 className="font-titre mt-5 text-2xl font-bold">Commencez par créer votre première fable</h2>
          <p className="mt-2 max-w-md font-semibold text-encre-doux">
            Rédigez le texte, ajoutez la morale et composez des exercices. Générez ensuite un code
            de parrainage pour que vos élèves rejoignent votre classe.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/enseignant/fables/nouvelle" className="btn-primaire">
              <Plus className="size-4.5" /> Créer une fable
            </Link>
            <Link href="/enseignant/codes" className="btn-ligne">
              <Ticket className="size-4.5" /> Générer un code de classe
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Activité 14 jours */}
          <div className="carte p-6 lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-titre text-lg font-bold">Activité des 14 derniers jours</h2>
              <span className="badge bg-sarcelle/10 text-sarcelle">
                <TrendingUp className="size-3.5" /> Score moyen {formatPct(s.scoreMoyenPct)} ·
                Réussite {formatPct(s.tauxReussite)}
              </span>
            </div>
            <CourbeActivite donnees={s.serie14} />
          </div>

          {/* Taux par fable */}
          <div className="carte p-6 lg:col-span-2">
            <h2 className="font-titre mb-4 text-lg font-bold">Réussite par fable</h2>
            {s.parFable.some((f) => f.tentatives > 0) ? (
              <BarresFables donnees={s.parFable.filter((f) => f.tentatives > 0)} />
            ) : (
              <p className="rounded-2xl bg-papier px-5 py-8 text-center font-semibold text-encre/45">
                Aucune tentative pour le moment. Partagez votre code de classe à vos élèves !
              </p>
            )}
          </div>
        </div>
      )}

      {/* Activités récentes */}
      {s.activitesRecentes.length > 0 && (
        <div className="carte overflow-hidden">
          <h2 className="font-titre border-b-2 border-encre/8 px-6 py-4 text-lg font-bold">
            Dernières réponses des élèves
          </h2>
          <ul className="divide-y-2 divide-encre/5">
            {s.activitesRecentes.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-6 py-3.5">
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-xl ${
                    a.estCorrect === true
                      ? "bg-sarcelle/12 text-sarcelle"
                      : a.estCorrect === null
                        ? "bg-ciel/12 text-ciel"
                        : "bg-corail/10 text-corail"
                  }`}
                >
                  {a.estCorrect === true ? (
                    <CheckCircle2 className="size-4.5" />
                  ) : a.estCorrect === null ? (
                    <Hourglass className="size-4.5" />
                  ) : (
                    <XCircle className="size-4.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">
                    {a.pseudo} · {a.fableTitre}
                  </p>
                  <p className="text-xs font-semibold text-encre/45">
                    {a.typeEtiquette} · {a.dateEtiquette}
                  </p>
                </div>
                <span className="font-titre text-sm font-bold text-encre/60">
                  {formatScore(a.score)} / {a.maxScore}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
