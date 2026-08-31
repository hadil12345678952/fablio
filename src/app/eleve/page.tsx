import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  Trophy,
  BookCheck,
  MousePointerClick,
  BookOpenText,
  Sparkles,
  Rabbit,
  Bird,
  Turtle,
  ArrowRight,
  Star,
} from "lucide-react";
import { lireSession } from "@/lib/auth";
import { fablesPourEleve, progressionEleve } from "@/lib/queries";
import { formatScore } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mes fables" };

const DIFFICULTES: Record<string, { label: string; icone: typeof Rabbit; style: string }> = {
  facile: { label: "Facile", icone: Rabbit, style: "bg-sarcelle text-white" },
  moyen: { label: "Moyen", icone: Bird, style: "bg-ambre text-white" },
  difficile: { label: "Difficile", icone: Turtle, style: "bg-corail text-white" },
};

export default async function PageAccueilEleve() {
  const session = await lireSession();
  if (!session || session.type !== "eleve") redirect("/connexion?role=eleve");

  const [fables, progression] = await Promise.all([
    fablesPourEleve(session.eleve),
    progressionEleve(session.eleve),
  ]);

  const cartes = [
    {
      label: "Mes points",
      valeur: formatScore(progression.pointsCumules),
      icone: Trophy,
      style: "from-ambre to-ambre-fonce",
    },
    {
      label: "Fables terminées",
      valeur: `${progression.fablesTerminees} / ${progression.nbFables}`,
      icone: BookCheck,
      style: "from-sarcelle to-sarcelle-fonce",
    },
    {
      label: "Exercices faits",
      valeur: String(progression.totalTentatives),
      icone: MousePointerClick,
      style: "from-lilas to-[#5f4fbf]",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Salutation */}
      <div className="anim-apparition">
        <p className="etiquette text-corail">Ma classe</p>
        <h1 className="font-titre mt-1 text-4xl font-bold tracking-tight sm:text-5xl">
          Salut, {session.eleve.pseudo} !
        </h1>
        <p className="mt-2 text-lg font-semibold text-encre-doux">
          Choisis une fable, lis-la bien, puis relève les défis.
        </p>
      </div>

      {/* Ma progression */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {cartes.map((c, i) => (
          <div
            key={c.label}
            className={`anim-apparition rounded-3xl bg-gradient-to-br ${c.style} p-4 text-white shadow-carte sm:p-5`}
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <c.icone className="size-6 sm:size-7" strokeWidth={2.4} />
            <p className="font-titre mt-2.5 text-2xl font-bold sm:text-3xl">{c.valeur}</p>
            <p className="text-xs font-extrabold text-white/80 sm:text-sm">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Les fables */}
      <div>
        <h2 className="font-titre mb-4 flex items-center gap-2.5 text-2xl font-bold">
          <Sparkles className="size-6 text-ambre-fonce" />
          Les fables de ma classe
        </h2>

        {fables.length === 0 ? (
          <div className="carte bg-points flex flex-col items-center px-8 py-16 text-center">
            <span className="grid size-20 place-items-center rounded-3xl bg-corail/12 text-corail">
              <BookOpenText className="size-10" />
            </span>
            <h3 className="font-titre mt-5 text-2xl font-bold">Bientôt de nouvelles histoires !</h3>
            <p className="mt-2 max-w-sm font-semibold text-encre-doux">
              Ton enseignant n&apos;a pas encore publié de fable. Reviens un peu plus tard !
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {fables.map((f, i) => {
              const diff = DIFFICULTES[f.difficulte] ?? DIFFICULTES.facile;
              const progressionPct =
                f.nbExercices > 0 ? Math.round((f.nbReussis / f.nbExercices) * 100) : 0;
              return (
                <article
                  key={f.id}
                  className="carte anim-apparition group relative overflow-hidden"
                  style={{ animationDelay: `${i * 0.07}s` }}
                >
                  {f.terminee && (
                    <span className="absolute top-4 -right-9 z-10 flex rotate-45 items-center gap-1.5 bg-sarcelle px-9 py-1.5 font-titre text-xs font-bold text-white shadow-carte">
                      <Star className="size-3.5 fill-current" /> TERMINÉE
                    </span>
                  )}
                  <Link href={`/eleve/fables/${f.id}`} className="block">
                    <div className="relative aspect-[16/8] overflow-hidden bg-gradient-to-br from-corail/15 via-ambre/10 to-sarcelle/10">
                      {f.imageUrl ? (
                        <Image
                          src={f.imageUrl}
                          alt={`Illustration de ${f.titre}`}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 640px) 100vw, 50vw"
                        />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center">
                          <BookOpenText className="size-14 text-encre/12" />
                        </span>
                      )}
                      <span className={`badge absolute top-3 left-3 ${diff.style}`}>
                        <diff.icone className="size-3.5" /> {diff.label}
                      </span>
                    </div>
                    <div className="p-5">
                      <h3 className="font-titre text-2xl leading-tight font-bold">{f.titre}</h3>
                      {f.morale && (
                        <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-encre/50">
                          {f.morale}
                        </p>
                      )}
                      <div className="mt-4">
                        <div className="mb-1.5 flex justify-between text-xs font-extrabold text-encre/45">
                          <span>
                            {f.nbReussis} / {f.nbExercices} exercice(s) réussi(s)
                          </span>
                          <span>{progressionPct} %</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-encre/8">
                          <div
                            className={`h-full rounded-full transition-all ${
                              f.terminee ? "bg-sarcelle" : "bg-corail"
                            }`}
                            style={{ width: `${Math.max(progressionPct, f.nbExercices ? 4 : 0)}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="btn-gomme inline-flex items-center gap-2 rounded-full bg-encre px-6 py-2.5 font-titre font-bold text-papier">
                          {f.nbReussis === 0 ? "Lire" : f.terminee ? "Revoir" : "Continuer"}
                          <ArrowRight className="size-4.5" />
                        </span>
                        <span className="text-xs font-extrabold text-encre/40">
                          {f.nbExercices} défi(s)
                        </span>
                      </div>
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
