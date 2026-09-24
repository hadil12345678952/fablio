import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  Trophy,
  BookCheck,
  Target,
  BookOpenText,
  Sparkles,
  Rabbit,
  Bird,
  Turtle,
  ArrowRight,
  Star,
  PlayCircle,
  RotateCcw,
  Compass,
  CheckCircle2,
  XCircle,
  Hourglass,
  Clock,
} from "lucide-react";
import { lireSession } from "@/lib/auth";
import { tableauDeBordEleve } from "@/lib/eleve/tableau-de-bord";
import { GrilleBadges } from "@/components/eleve/badges";
import { formatScore, formatDuree } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mon tableau de bord" };

const DIFFICULTES: Record<string, { label: string; icone: typeof Rabbit; style: string }> = {
  facile: { label: "Facile", icone: Rabbit, style: "bg-menthe text-white" },
  moyen: { label: "Moyen", icone: Bird, style: "bg-ambre text-white" },
  difficile: { label: "Difficile", icone: Turtle, style: "bg-rose text-white" },
};

const STATUTS = {
  terminee: { label: "Terminée", style: "bg-menthe/15 text-menthe-fonce", icone: BookCheck },
  en_cours: { label: "En cours", style: "bg-ambre/18 text-ambre-fonce", icone: Clock },
  a_commencer: { label: "À découvrir", style: "bg-azur/12 text-azur", icone: Compass },
} as const;

/** Salutation selon l'heure — simple et chaleureuse pour un enfant. */
function salutation(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

export default async function PageAccueilEleve() {
  const session = await lireSession();
  if (!session || session.type !== "eleve") redirect("/connexion?role=eleve");

  const tb = await tableauDeBordEleve(session.eleve);
  const aDesFables = tb.nbFables > 0;

  const cartes = [
    {
      label: "Mes points",
      valeur: formatScore(tb.points),
      sous: tb.pointsMax > 0 ? `sur ${tb.pointsMax}` : "à gagner",
      icone: Trophy,
      style: "from-ambre to-ambre-fonce",
    },
    {
      label: "Fables terminées",
      valeur: `${tb.fablesTerminees}`,
      sous: `sur ${tb.nbFables}`,
      icone: BookCheck,
      style: "from-menthe to-menthe-fonce",
    },
    {
      label: "Exercices réussis",
      valeur: `${tb.exercicesReussis}`,
      sous: `sur ${tb.exercicesTotal}`,
      icone: Target,
      style: "from-azur to-azur-fonce",
    },
  ];

  return (
    <div className="space-y-8">
      {/* ---------- Salutation + progression globale ---------- */}
      <section className="anim-apparition bg-arc-enfant relative overflow-hidden rounded-[2rem] border-2 border-encre/8 px-6 py-7 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="etiquette text-rose">Mon tableau de bord</p>
            <h1 className="font-titre mt-1 text-4xl font-bold tracking-tight sm:text-5xl">
              {salutation()}, {tb.pseudo} !
            </h1>
            <p className="mt-2 text-lg font-semibold text-encre-doux">
              {tb.totalTentatives === 0
                ? "Prêt·e à découvrir ta première fable ?"
                : tb.fablesTerminees > 0
                  ? `Bravo, tu as déjà terminé ${tb.fablesTerminees} fable${tb.fablesTerminees > 1 ? "s" : ""} !`
                  : "Continue ton parcours, tu es sur la bonne voie !"}
            </p>
          </div>
          {aDesFables && (
            <div className="w-full max-w-xs">
              <div className="mb-1.5 flex items-center justify-between text-sm font-extrabold">
                <span className="text-encre-doux">Mon avancement</span>
                <span className="font-titre text-rose">{tb.progressionGlobalePct} %</span>
              </div>
              <div className="h-4 overflow-hidden rounded-full border-2 border-encre/10 bg-white">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose via-ambre to-menthe transition-all duration-700"
                  style={{ width: `${Math.max(tb.progressionGlobalePct, 2)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs font-bold text-encre/50">
                {tb.exercicesReussis} exercice{tb.exercicesReussis > 1 ? "s" : ""} réussi
                {tb.exercicesReussis > 1 ? "s" : ""} sur {tb.exercicesTotal}
              </p>
            </div>
          )}
        </div>

        {/* Badges déjà obtenus (aperçu) */}
        {tb.badges.some((b) => b.obtenu) && (
          <div className="mt-5 border-t-2 border-dashed border-encre/10 pt-4">
            <p className="etiquette mb-2">Mes badges</p>
            <GrilleBadges badges={tb.badges} compact />
          </div>
        )}
      </section>

      {/* ---------- Reprendre là où j'en suis ---------- */}
      {tb.reprise && (
        <section
          className="carte anim-apparition overflow-hidden"
          style={{ animationDelay: "0.05s" }}
        >
          <div className="flex flex-col gap-0 sm:flex-row">
            <div className="relative aspect-[16/9] w-full shrink-0 bg-gradient-to-br from-rose/15 to-azur/10 sm:aspect-auto sm:w-64">
              {tb.reprise.imageUrl ? (
                <Image
                  src={tb.reprise.imageUrl}
                  alt={`Illustration de ${tb.reprise.titre}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 256px"
                />
              ) : (
                <span className="absolute inset-0 grid place-items-center">
                  <BookOpenText className="size-12 text-encre/15" />
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col justify-center p-6">
              <p className="etiquette text-rose">
                {tb.reprise.action === "continuer"
                  ? "Reprends ici"
                  : tb.reprise.action === "revoir"
                    ? "Tu peux revoir"
                    : "À découvrir"}
              </p>
              <h2 className="font-titre mt-1 text-2xl font-bold sm:text-3xl">
                {tb.reprise.titre}
              </h2>
              {tb.reprise.nbExercices > 0 && (
                <p className="mt-1.5 font-semibold text-encre-doux">
                  {tb.reprise.nbReussis} / {tb.reprise.nbExercices} exercice(s) réussi(s)
                </p>
              )}
              <Link
                href={`/eleve/fables/${tb.reprise.fableId}`}
                className="btn-gomme mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-rose px-6 py-3 font-titre text-lg font-bold text-white"
              >
                {tb.reprise.action === "continuer" ? (
                  <>
                    <PlayCircle className="size-5.5" /> Continuer
                  </>
                ) : tb.reprise.action === "revoir" ? (
                  <>
                    <RotateCcw className="size-5.5" /> Revoir
                  </>
                ) : (
                  <>
                    <Compass className="size-5.5" /> Découvrir
                  </>
                )}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Mes compteurs ---------- */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {cartes.map((c, i) => (
          <div
            key={c.label}
            className={`anim-apparition rounded-3xl bg-gradient-to-br ${c.style} p-4 text-white shadow-carte sm:p-5`}
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            <c.icone className="size-6 sm:size-7" strokeWidth={2.4} />
            <p className="font-titre mt-2.5 text-2xl font-bold sm:text-3xl">{c.valeur}</p>
            <p className="text-xs font-extrabold text-white/85 sm:text-sm">{c.label}</p>
            <p className="text-[11px] font-bold text-white/70">{c.sous}</p>
          </div>
        ))}
      </div>

      {/* ---------- Mon parcours de fables ---------- */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-titre flex items-center gap-2.5 text-2xl font-bold sm:text-3xl">
            <Sparkles className="size-6 text-ambre-fonce" />
            Mon parcours
          </h2>
          {aDesFables && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className="badge bg-menthe/15 text-menthe-fonce">
                {tb.fablesTerminees} terminée(s)
              </span>
              <span className="badge bg-ambre/18 text-ambre-fonce">
                {tb.fablesCommencees} en cours
              </span>
              <span className="badge bg-azur/12 text-azur">
                {tb.nbFables - tb.fablesTerminees - tb.fablesCommencees} à découvrir
              </span>
            </div>
          )}
        </div>

        {!aDesFables ? (
          <div className="carte bg-points flex flex-col items-center px-8 py-16 text-center">
            <span className="grid size-20 place-items-center rounded-3xl bg-rose/12 text-rose">
              <BookOpenText className="size-10" />
            </span>
            <h3 className="font-titre mt-5 text-2xl font-bold">
              Bientôt de nouvelles histoires !
            </h3>
            <p className="mt-2 max-w-sm font-semibold text-encre-doux">
              Ton enseignant n&apos;a pas encore publié de fable. Reviens un peu plus tard !
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {tb.parcours.map((f, i) => {
              const diff = DIFFICULTES[f.difficulte] ?? DIFFICULTES.facile;
              const st = STATUTS[f.statut];
              return (
                <article
                  key={f.id}
                  className="carte anim-apparition group relative overflow-hidden"
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  {f.statut === "terminee" && (
                    <span className="font-titre absolute top-4 -right-9 z-10 flex rotate-45 items-center gap-1.5 bg-menthe px-9 py-1.5 text-xs font-bold text-white shadow-carte">
                      <Star className="size-3.5 fill-current" /> TERMINÉE
                    </span>
                  )}
                  <Link href={`/eleve/fables/${f.id}`} className="block">
                    <div className="relative aspect-[16/8] overflow-hidden bg-gradient-to-br from-rose/12 via-ambre/10 to-menthe/10">
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
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className={`badge ${st.style}`}>
                          <st.icone className="size-3.5" /> {st.label}
                        </span>
                        {f.points > 0 && (
                          <span className="badge border-2 border-encre/10 bg-white text-encre/55">
                            <Trophy className="size-3 text-ambre-fonce" />{" "}
                            {formatScore(f.points)} / {f.pointsMax} pts
                          </span>
                        )}
                      </div>
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
                          <span>{f.progressionPct} %</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-encre/8">
                          <div
                            className={`h-full rounded-full transition-all ${
                              f.statut === "terminee"
                                ? "bg-menthe"
                                : f.statut === "en_cours"
                                  ? "bg-ambre"
                                  : "bg-azur/40"
                            }`}
                            style={{
                              width: `${Math.max(f.progressionPct, f.nbExercices ? 3 : 0)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="btn-gomme inline-flex items-center gap-2 rounded-full bg-encre px-5 py-2.5 font-titre font-bold text-papier">
                          {f.statut === "a_commencer"
                            ? "Découvrir"
                            : f.statut === "terminee"
                              ? "Revoir"
                              : "Continuer"}
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
      </section>

      {/* ---------- Mes dernières activités ---------- */}
      {tb.activitesRecentes.length > 0 && (
        <section className="carte overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-encre/8 bg-papier px-6 py-4">
            <h2 className="font-titre text-xl font-bold">Ce que j&apos;ai fait récemment</h2>
            <span className="text-xs font-bold text-encre/45">
              Temps total : {formatDuree(tb.tempsTotalSecondes)}
            </span>
          </div>
          <ul className="divide-y-2 divide-encre/5">
            {tb.activitesRecentes.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-6 py-3.5">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                    a.estCorrect === true
                      ? "bg-menthe/15 text-menthe-fonce"
                      : a.estCorrect === null
                        ? "bg-azur/12 text-azur"
                        : "bg-rose/10 text-rose"
                  }`}
                >
                  {a.estCorrect === true ? (
                    <CheckCircle2 className="size-5" />
                  ) : a.estCorrect === null ? (
                    <Hourglass className="size-5" />
                  ) : (
                    <XCircle className="size-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">
                    {a.fableTitre}{" "}
                    <span className="font-semibold text-encre/45">· {a.typeEtiquette}</span>
                  </p>
                  <p className="text-xs font-semibold text-encre/45">{a.dateEtiquette}</p>
                </div>
                <span className="font-titre shrink-0 text-sm font-bold text-encre/60">
                  {a.estCorrect === null
                    ? "à corriger"
                    : `${formatScore(a.score)} / ${a.maxScore}`}
                </span>
                <Link
                  href={`/eleve/fables/${a.fableId}`}
                  className="btn-ligne shrink-0 px-3 py-1.5 text-xs"
                >
                  Revoir
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
