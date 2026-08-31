import Link from "next/link";
import Image from "next/image";
import {
  BookOpenText,
  ListChecks,
  ToggleLeft,
  TextCursorInput,
  ArrowUpDown,
  Link2,
  PenLine,
  GraduationCap,
  Sparkles,
  BarChart3,
  Ticket,
  PencilRuler,
  Users,
  FileDown,
  Star,
  Feather,
  MousePointerClick,
  ShieldCheck,
  Quote,
  ArrowRight,
  Leaf,
} from "lucide-react";
import { lireSession } from "@/lib/auth";

const fablesDefilantes = [
  "La Cigale et la Fourmi",
  "Le Corbeau et le Renard",
  "Le Lièvre et la Tortue",
  "Le Lion et le Rat",
  "La Grenouille qui veut se faire aussi grosse que le Bœuf",
  "Le Petit Poisson et le Pêcheur",
  "Le Loup et l'Agneau",
  "La Fourmi et la Colombe",
];

const typesExercices = [
  {
    icone: ListChecks,
    couleur: "bg-corail/10 text-corail",
    titre: "QCM",
    texte: "3 ou 4 propositions, une ou plusieurs bonnes réponses choisies par l'enseignant.",
  },
  {
    icone: ToggleLeft,
    couleur: "bg-sarcelle/10 text-sarcelle",
    titre: "Vrai / Faux",
    texte: "Une affirmation à juger : parfait pour vérifier la compréhension globale.",
  },
  {
    icone: TextCursorInput,
    couleur: "bg-ambre/15 text-ambre-fonce",
    titre: "Texte à trous",
    texte: "Des mots de la fable à retrouver, en saisie libre ou avec une banque de mots.",
  },
  {
    icone: ArrowUpDown,
    couleur: "bg-lilas/10 text-lilas",
    titre: "Remise en ordre",
    texte: "Replacer les événements du récit dans le bon ordre, du début à la morale.",
  },
  {
    icone: Link2,
    couleur: "bg-ciel/10 text-ciel",
    titre: "Association",
    texte: "Relier personnages et caractéristiques, mots et définitions, deux colonnes à apparier.",
  },
  {
    icone: PenLine,
    couleur: "bg-rose/10 text-rose",
    titre: "Question ouverte",
    texte: "Une réponse courte rédigée par l'élève, corrigée automatiquement ou par l'enseignant.",
  },
];

const etapes = [
  {
    numero: "1",
    icone: PencilRuler,
    titre: "L'enseignant crée",
    texte: "Rédigez ou collez le texte de la fable, ajoutez la morale, puis composez vos exercices parmi 6 types. Prévisualisez exactement ce que verra l'élève.",
  },
  {
    numero: "2",
    icone: Ticket,
    titre: "Les élèves rejoignent",
    texte: "Un code de parrainage par classe : l'élève choisit un pseudo, un code secret, et se retrouve rattaché à son enseignant. Aucune adresse email nécessaire.",
  },
  {
    numero: "3",
    icone: BarChart3,
    titre: "Le suivi s'affiche",
    texte: "Scores, tentatives, temps passé, erreurs fréquentes par question : des tableaux et graphiques simples, exportables au format CSV.",
  },
];

export default async function PageAccueil() {
  const session = await lireSession();
  const lienTableau =
    session?.type === "enseignant" ? "/enseignant" : session?.type === "eleve" ? "/eleve" : null;

  return (
    <div className="min-h-dvh overflow-x-clip">
      {/* ---------- En-tête ---------- */}
      <header className="sticky top-0 z-40 border-b-2 border-encre/8 bg-papier/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-2xl bg-corail text-white shadow-carte">
              <BookOpenText className="size-5" strokeWidth={2.4} />
            </span>
            <span className="font-titre text-2xl font-bold tracking-tight">Fablio</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-bold text-encre-doux md:flex">
            <a href="#fonctionnement" className="transition-colors hover:text-corail">
              Fonctionnement
            </a>
            <a href="#exercices" className="transition-colors hover:text-corail">
              Exercices
            </a>
            <a href="#suivi" className="transition-colors hover:text-corail">
              Suivi
            </a>
          </nav>
          <div className="flex items-center gap-2.5">
            {lienTableau ? (
              <Link href={lienTableau} className="btn-primaire">
                Mon espace <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link href="/connexion" className="btn-fantome hidden sm:inline-flex">
                  Se connecter
                </Link>
                <Link href="/inscription" className="btn-primaire">
                  Commencer <Sparkles className="size-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ---------- Héros ---------- */}
      <section className="bg-points relative">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-16 pb-14 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24 lg:pb-20">
          <div className="anim-apparition">
            <span className="badge border-2 border-encre/10 bg-white text-encre-doux">
              <Leaf className="size-3.5 text-sarcelle" />
              Plateforme éducative · École primaire
            </span>
            <h1 className="font-titre mt-6 text-5xl leading-[1.04] font-bold tracking-tight text-balance sm:text-6xl lg:text-[4.35rem]">
              Les fables prennent{" "}
              <span className="relative inline-block text-corail">
                vie
                <svg
                  viewBox="0 0 120 14"
                  className="absolute -bottom-2 left-0 w-full text-ambre"
                  aria-hidden
                >
                  <path
                    d="M3 10 C 25 3, 45 12, 62 8 S 100 3, 117 9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>{" "}
              en classe.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed font-semibold text-encre-doux">
              Fablio permet à l&apos;enseignant de créer ses propres fables et exercices, aux
              élèves de 7 à 10 ans de lire, jouer et retenir la morale — avec un suivi
              statistique complet, en français.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/inscription?role=enseignant" className="btn-primaire px-7 py-3.5 text-base">
                <GraduationCap className="size-5" /> Je suis enseignant
              </Link>
              <Link href="/inscription?role=eleve" className="btn-ligne px-7 py-3.5 text-base">
                <MousePointerClick className="size-5" /> Je suis élève
              </Link>
            </div>
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {[
                ["6", "types d'exercices"],
                ["100 %", "gratuit & open source"],
                ["0", "email requis pour l'élève"],
              ].map(([chiffre, legende]) => (
                <div key={legende}>
                  <dt className="etiquette">{legende}</dt>
                  <dd className="font-titre text-3xl font-bold text-encre">{chiffre}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Illustration héros + cartes flottantes */}
          <div className="anim-apparition relative" style={{ animationDelay: "0.15s" }}>
            <div className="relative rotate-1 rounded-[2rem] border-3 border-encre/12 bg-white p-3 shadow-carte">
              <div className="relative aspect-[5/4] overflow-hidden rounded-3xl">
                <Image
                  src="/images/hero-fables.png"
                  alt="Les personnages des fables rassemblés autour d'un grand livre ouvert"
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </div>
            <div
              className="anim-flotter absolute -top-5 -left-4 flex items-center gap-2.5 rounded-2xl border-2 border-encre/10 bg-white px-4 py-3 shadow-carte sm:-left-8"
              style={{ "--rotation": "-3deg" } as React.CSSProperties}
            >
              <span className="grid size-9 place-items-center rounded-xl bg-sarcelle/15 text-sarcelle">
                <Star className="size-5 fill-current" />
              </span>
              <div>
                <p className="text-xs font-extrabold text-encre-doux">Le Corbeau et le Renard</p>
                <p className="font-titre text-sm font-bold">Fable terminée · 10/10</p>
              </div>
            </div>
            <div
              className="anim-flotter absolute -right-3 -bottom-6 flex items-center gap-2.5 rounded-2xl border-2 border-encre/10 bg-white px-4 py-3 shadow-carte sm:-right-6"
              style={{ "--rotation": "2.5deg", animationDelay: "1.2s" } as React.CSSProperties}
            >
              <span className="grid size-9 place-items-center rounded-xl bg-ambre/20 text-ambre-fonce">
                <Ticket className="size-5" />
              </span>
              <div>
                <p className="text-xs font-extrabold text-encre-doux">Code de ma classe</p>
                <p className="font-titre text-sm font-bold tracking-widest">CE2A-X7K2Q</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Bandeau défilant ---------- */}
      <div className="overflow-hidden border-y-2 border-encre/10 bg-ambre/15 py-3.5">
        <div className="anim-defilement flex w-max items-center gap-8 pr-8">
          {[...fablesDefilantes, ...fablesDefilantes].map((titre, i) => (
            <span key={i} className="flex items-center gap-8 whitespace-nowrap">
              <span className="font-titre text-sm font-bold text-encre/70">{titre}</span>
              <Feather className="size-4 text-ambre-fonce/70" />
            </span>
          ))}
        </div>
      </div>

      {/* ---------- Fonctionnement ---------- */}
      <section id="fonctionnement" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 lg:py-28">
        <div className="max-w-2xl">
          <p className="etiquette text-corail">Fonctionnement</p>
          <h2 className="font-titre mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Trois étapes, une classe entière qui lit.
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {etapes.map((etape, i) => (
            <article
              key={etape.numero}
              className="carte anim-apparition relative p-7"
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              <span className="font-titre absolute -top-5 right-6 grid size-11 place-items-center rounded-2xl bg-encre text-xl font-bold text-papier shadow-carte">
                {etape.numero}
              </span>
              <span className="grid size-12 place-items-center rounded-2xl bg-corail/10 text-corail">
                <etape.icone className="size-6" />
              </span>
              <h3 className="font-titre mt-5 text-2xl font-bold">{etape.titre}</h3>
              <p className="mt-2.5 leading-relaxed font-semibold text-encre-doux">
                {etape.texte}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Types d'exercices ---------- */}
      <section id="exercices" className="scroll-mt-24 border-y-2 border-encre/8 bg-papier-fonce/50 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="etiquette text-corail">Boîte à outils</p>
            <h2 className="font-titre mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Six façons de faire réfléchir les élèves
            </h2>
            <p className="mt-4 text-lg font-semibold text-encre-doux">
              Chaque exercice est paramétrable : consigne, points, feedback immédiat, nombre de
              tentatives — et prévisualisable avant publication.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {typesExercices.map((type, i) => (
              <article
                key={type.titre}
                className="carte anim-apparition group p-6 transition-transform duration-300 hover:-translate-y-1.5"
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <span
                  className={`grid size-12 place-items-center rounded-2xl transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110 ${type.couleur}`}
                >
                  <type.icone className="size-6" />
                </span>
                <h3 className="font-titre mt-4 text-xl font-bold">{type.titre}</h3>
                <p className="mt-1.5 text-sm leading-relaxed font-semibold text-encre-doux">
                  {type.texte}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Suivi statistique ---------- */}
      <section id="suivi" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="etiquette text-corail">Suivi statistique</p>
            <h2 className="font-titre mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Comprendre où chaque élève en est
            </h2>
            <ul className="mt-8 space-y-5">
              {[
                {
                  icone: Users,
                  titre: "Par élève",
                  texte: "Fables complétées, score moyen, temps passé, tentatives et progression jour après jour.",
                },
                {
                  icone: BarChart3,
                  titre: "Par fable et par exercice",
                  texte: "Taux de réussite, répartition des réponses au QCM, mots les plus souvent manqués au texte à trous.",
                },
                {
                  icone: FileDown,
                  titre: "Export des données",
                  texte: "Un clic pour obtenir toutes les réponses en CSV (Excel) ou imprimer le rapport en PDF.",
                },
                {
                  icone: ShieldCheck,
                  titre: "Sécurité pensée pour l'école",
                  texte: "Mots de passe hachés, sessions sécurisées, accès strictement réservé à chaque rôle.",
                },
              ].map((point) => (
                <li key={point.titre} className="flex gap-4">
                  <span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-2xl bg-sarcelle/10 text-sarcelle">
                    <point.icone className="size-5.5" />
                  </span>
                  <div>
                    <h3 className="font-titre text-lg font-bold">{point.titre}</h3>
                    <p className="font-semibold text-encre-doux">{point.texte}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Maquette de tableau de bord */}
          <div className="carte anim-apparition overflow-hidden" style={{ animationDelay: "0.1s" }}>
            <div className="flex items-center justify-between border-b-2 border-encre/8 bg-papier px-6 py-4">
              <p className="font-titre font-bold">Taux de réussite par exercice</p>
              <span className="badge bg-sarcelle/10 text-sarcelle">CE2 · Semaine 12</span>
            </div>
            <div className="space-y-5 px-6 py-6">
              {[
                ["QCM — Qui travaille tout l'été ?", 86, "bg-corail"],
                ["Vrai/Faux — La cigale a dansé", 92, "bg-sarcelle"],
                ["Texte à trous — « se trouva fort {dépourvue} »", 58, "bg-ambre"],
                ["Remise en ordre du récit", 74, "bg-lilas"],
                ["Association mots ↔ définitions", 81, "bg-ciel"],
              ].map(([label, val, couleur]) => (
                <div key={label as string}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-bold">{label}</span>
                    <span className="font-titre shrink-0 font-bold text-encre-doux">{val} %</span>
                  </div>
                  <div className="h-3.5 overflow-hidden rounded-full bg-encre/8">
                    <div
                      className={`h-full rounded-full ${couleur}`}
                      style={{ width: `${val}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="rounded-2xl bg-ambre/12 px-4 py-3 text-sm font-bold text-ambre-fonce">
                Erreur fréquente : « dépourvue » est souvent écrit « depourvu » (8 élèves sur 24).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Citation ---------- */}
      <section className="px-5 pb-20">
        <figure className="carte bg-points relative mx-auto max-w-3xl overflow-hidden px-8 py-12 text-center">
          <Quote className="mx-auto size-10 rotate-180 text-corail/40" aria-hidden />
          <blockquote className="font-lecture mt-4 text-2xl leading-relaxed font-medium text-balance sm:text-3xl">
            « Sans mentir, si votre ramage se rapporte à votre plumage, vous êtes le phénix des
            hôtes de ces bois. »
          </blockquote>
          <figcaption className="mt-5 text-sm font-extrabold tracking-widest text-encre/50 uppercase">
            Jean de La Fontaine — Le Corbeau et le Renard
          </figcaption>
        </figure>
      </section>

      {/* ---------- Appel à l'action ---------- */}
      <section className="mx-5 mb-20">
        <div className="bg-points-clair relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-encre px-8 py-16 text-center text-papier sm:px-16">
          <h2 className="font-titre mx-auto max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Prêt à faire entrer les fables dans votre classe ?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg font-semibold text-papier/70">
            Créez votre compte en une minute, générez le code de votre classe, et laissez les
            histoires faire le reste.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/inscription?role=enseignant" className="btn bg-corail px-7 py-3.5 text-base text-white hover:bg-corail-fonce">
              <GraduationCap className="size-5" /> Créer mon espace enseignant
            </Link>
            <Link href="/connexion" className="btn border-2 border-papier/25 px-7 py-3.5 text-base text-papier hover:bg-papier/10">
              J'ai déjà un compte
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Pied de page ---------- */}
      <footer className="border-t-2 border-encre/8 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-5 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-corail text-white">
              <BookOpenText className="size-4.5" strokeWidth={2.4} />
            </span>
            <div>
              <p className="font-titre text-lg font-bold">Fablio</p>
              <p className="text-xs font-bold text-encre/45">
                Projet de master professionnel — technologies éducatives
              </p>
            </div>
          </div>
          <p className="text-sm font-bold text-encre/50">
            Conçu pour l&apos;école primaire · 100 % gratuit et open source
          </p>
        </div>
      </footer>
    </div>
  );
}
