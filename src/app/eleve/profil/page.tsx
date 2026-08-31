import { redirect } from "next/navigation";
import {
  Trophy,
  BookCheck,
  MousePointerClick,
  Timer,
  CheckCircle2,
  XCircle,
  Hourglass,
  Star,
  Feather,
  BookOpenText,
  Crown,
  Flame,
  Medal,
  Lock,
} from "lucide-react";
import { lireSession } from "@/lib/auth";
import { progressionEleve } from "@/lib/queries";
import { etiquetteDate, formatDuree, formatScore, initiales } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mon profil" };

export default async function PageProfilEleve() {
  const session = await lireSession();
  if (!session || session.type !== "eleve") redirect("/connexion?role=eleve");
  const p = await progressionEleve(session.eleve);

  const badges = [
    {
      nom: "Premier pas",
      description: "Terminer un premier exercice",
      icone: Feather,
      debloque: p.totalTentatives >= 1,
    },
    {
      nom: "Petit lecteur",
      description: "Terminer une fable entière",
      icone: BookOpenText,
      debloque: p.fablesTerminees >= 1,
    },
    {
      nom: "Persévérant",
      description: "Faire 10 exercices",
      icone: Flame,
      debloque: p.totalTentatives >= 10,
    },
    {
      nom: "Collectionneur",
      description: "Terminer 3 fables",
      icone: Medal,
      debloque: p.fablesTerminees >= 3,
    },
    {
      nom: "Étoile d'or",
      description: "Gagner 100 points",
      icone: Star,
      debloque: p.pointsCumules >= 100,
    },
    {
      nom: "Champion des fables",
      description: "Gagner 300 points",
      icone: Crown,
      debloque: p.pointsCumules >= 300,
    },
  ];

  const cartes = [
    { label: "Points gagnés", valeur: formatScore(p.pointsCumules), icone: Trophy, style: "bg-ambre/15 text-ambre-fonce" },
    { label: "Fables terminées", valeur: `${p.fablesTerminees} / ${p.nbFables}`, icone: BookCheck, style: "bg-sarcelle/12 text-sarcelle" },
    { label: "Exercices faits", valeur: String(p.totalTentatives), icone: MousePointerClick, style: "bg-lilas/12 text-lilas" },
    { label: "Temps de jeu", valeur: formatDuree(p.tempsTotalSecondes), icone: Timer, style: "bg-ciel/12 text-ciel" },
  ];

  return (
    <div className="space-y-8">
      {/* Identité */}
      <div className="anim-apparition flex flex-wrap items-center gap-5">
        <span className="font-titre grid size-20 place-items-center rounded-3xl bg-corail text-3xl font-bold text-white shadow-carte">
          {initiales(session.eleve.pseudo)}
        </span>
        <div>
          <p className="etiquette text-corail">Mon profil</p>
          <h1 className="font-titre text-4xl font-bold tracking-tight">{session.eleve.pseudo}</h1>
          <p className="mt-1 font-semibold text-encre-doux">
            Dans la classe depuis le {etiquetteDate(session.eleve.creeLe)}
            {p.derniereActivite ? ` · dernier exercice : ${p.derniereActivite}` : ""}
          </p>
        </div>
      </div>

      {/* Chiffres */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
        {cartes.map((c, i) => (
          <div key={c.label} className="carte anim-apparition p-5" style={{ animationDelay: `${i * 0.07}s` }}>
            <span className={`grid size-11 place-items-center rounded-2xl ${c.style}`}>
              <c.icone className="size-5.5" />
            </span>
            <p className="font-titre mt-3 text-3xl font-bold">{c.valeur}</p>
            <p className="text-sm font-bold text-encre/50">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Badges */}
      <section>
        <h2 className="font-titre mb-4 text-2xl font-bold">Mes badges</h2>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
          {badges.map((b) => (
            <div
              key={b.nom}
              className={`rounded-3xl border-3 p-4 text-center transition-all ${
                b.debloque
                  ? "border-ambre/50 bg-gradient-to-b from-ambre/15 to-white shadow-carte"
                  : "border-encre/10 bg-encre/[0.03] opacity-70"
              }`}
            >
              <span
                className={`mx-auto grid size-13 place-items-center rounded-2xl ${
                  b.debloque ? "bg-ambre text-white" : "bg-encre/10 text-encre/35"
                }`}
              >
                {b.debloque ? <b.icone className="size-6" /> : <Lock className="size-5" />}
              </span>
              <p className="font-titre mt-2.5 text-sm leading-tight font-bold">{b.nom}</p>
              <p className="mt-1 text-[11px] leading-tight font-bold text-encre/45">
                {b.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Historique */}
      <section className="carte overflow-hidden">
        <h2 className="font-titre border-b-2 border-encre/8 px-6 py-4 text-2xl font-bold">
          Mon historique
        </h2>
        {p.historique.length === 0 ? (
          <p className="px-6 py-10 text-center font-semibold text-encre/45">
            Tu n&apos;as pas encore fait d&apos;exercice. Choisis une fable et lance-toi !
          </p>
        ) : (
          <ul className="divide-y-2 divide-encre/5">
            {p.historique.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3 px-6 py-3.5">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                    h.estCorrect === true
                      ? "bg-sarcelle/12 text-sarcelle"
                      : h.estCorrect === null
                        ? "bg-ciel/12 text-ciel"
                        : "bg-corail/10 text-corail"
                  }`}
                >
                  {h.estCorrect === true ? (
                    <CheckCircle2 className="size-5" />
                  ) : h.estCorrect === null ? (
                    <Hourglass className="size-5" />
                  ) : (
                    <XCircle className="size-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">
                    {h.fableTitre} <span className="font-semibold text-encre/45">· {h.typeEtiquette}</span>
                  </p>
                  <p className="text-xs font-semibold text-encre/45">
                    tentative n°{h.numero} · {formatDuree(h.dureeSecondes)} · {h.dateEtiquette}
                  </p>
                </div>
                <span className="font-titre text-lg font-bold">
                  {h.estCorrect === null ? "à corriger" : `${formatScore(h.score)} / ${h.maxScore}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
