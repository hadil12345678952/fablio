import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Trophy,
  BookCheck,
  Target,
  Timer,
  CheckCircle2,
  XCircle,
  Hourglass,
  ArrowRight,
} from "lucide-react";
import { lireSession } from "@/lib/auth";
import { progressionEleve } from "@/lib/queries";
import { tableauDeBordEleve } from "@/lib/eleve/tableau-de-bord";
import { GrilleBadges } from "@/components/eleve/badges";
import { etiquetteDate, formatDuree, formatScore, initiales } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mon profil" };

export default async function PageProfilEleve() {
  const session = await lireSession();
  if (!session || session.type !== "eleve") redirect("/connexion?role=eleve");

  // Les deux sources sont réelles : le tableau de bord fournit badges et
  // compteurs consolidés, la progression fournit l'historique détaillé.
  const [tb, p] = await Promise.all([
    tableauDeBordEleve(session.eleve),
    progressionEleve(session.eleve),
  ]);

  const cartes = [
    {
      label: "Points gagnés",
      valeur: formatScore(tb.points),
      sous: tb.pointsMax > 0 ? `sur ${tb.pointsMax}` : "",
      icone: Trophy,
      style: "bg-ambre/15 text-ambre-fonce",
    },
    {
      label: "Fables terminées",
      valeur: `${tb.fablesTerminees} / ${tb.nbFables}`,
      sous: `${tb.fablesCommencees} en cours`,
      icone: BookCheck,
      style: "bg-menthe/12 text-menthe-fonce",
    },
    {
      label: "Exercices réussis",
      valeur: `${tb.exercicesReussis} / ${tb.exercicesTotal}`,
      sous: `${tb.totalTentatives} essai(s)`,
      icone: Target,
      style: "bg-azur/12 text-azur",
    },
    {
      label: "Temps de lecture",
      valeur: formatDuree(tb.tempsTotalSecondes),
      sous: tb.derniereActivite ? `dernier : ${tb.derniereActivite}` : "",
      icone: Timer,
      style: "bg-lilas/12 text-lilas",
    },
  ];

  const badgesObtenus = tb.badges.filter((b) => b.obtenu).length;

  return (
    <div className="space-y-8">
      {/* Identité */}
      <div className="anim-apparition flex flex-wrap items-center gap-5">
        <span className="font-titre grid size-20 place-items-center rounded-3xl bg-rose text-3xl font-bold text-white shadow-carte">
          {initiales(session.eleve.pseudo)}
        </span>
        <div>
          <p className="etiquette text-rose">Mon profil</p>
          <h1 className="font-titre text-4xl font-bold tracking-tight">
            {session.eleve.pseudo}
          </h1>
          <p className="mt-1 font-semibold text-encre-doux">
            Dans la classe depuis le {etiquetteDate(session.eleve.creeLe)} ·{" "}
            {badgesObtenus} badge{badgesObtenus > 1 ? "s" : ""} obtenu
            {badgesObtenus > 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/eleve" className="btn-ligne ml-auto">
          Mon tableau de bord <ArrowRight className="size-4" />
        </Link>
      </div>

      {/* Chiffres */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
        {cartes.map((c, i) => (
          <div
            key={c.label}
            className="carte anim-apparition p-5"
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            <span className={`grid size-11 place-items-center rounded-2xl ${c.style}`}>
              <c.icone className="size-5.5" />
            </span>
            <p className="font-titre mt-3 text-2xl font-bold">{c.valeur}</p>
            <p className="text-sm font-bold text-encre/50">{c.label}</p>
            {c.sous && <p className="text-xs font-bold text-encre/35">{c.sous}</p>}
          </div>
        ))}
      </div>

      {/* Badges (même moteur que le tableau de bord — règles réelles) */}
      <section>
        <h2 className="font-titre mb-4 text-2xl font-bold">Mes badges</h2>
        <GrilleBadges badges={tb.badges} />
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
                      ? "bg-menthe/15 text-menthe-fonce"
                      : h.estCorrect === null
                        ? "bg-azur/12 text-azur"
                        : "bg-rose/10 text-rose"
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
                    {h.fableTitre}{" "}
                    <span className="font-semibold text-encre/45">· {h.typeEtiquette}</span>
                  </p>
                  <p className="text-xs font-semibold text-encre/45">
                    tentative n°{h.numero} · {formatDuree(h.dureeSecondes)} · {h.dateEtiquette}
                  </p>
                </div>
                <span className="font-titre text-lg font-bold">
                  {h.estCorrect === null
                    ? "à corriger"
                    : `${formatScore(h.score)} / ${h.maxScore}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
