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
  Clapperboard,
  PuzzleIcon,
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
  Volume2,
  Heart,
  Rocket,
} from "lucide-react";
import { lireSession } from "@/lib/auth";

const fablesDefilantes = [
  "La Cigale et la Fourmi",
  "Le Corbeau et le Renard",
  "Le Lièvre et la Tortue",
  "Le Lion et le Rat",
  "La Grenouille et le Bœuf",
  "Le Petit Poisson et le Pêcheur",
  "Le Loup et l'Agneau",
  "La Fourmi et la Colombe",
];

const typesExercices = [
  { icone: ListChecks, couleur: "bg-rose/12 text-rose", titre: "QCM", texte: "Plusieurs propositions, une ou plusieurs bonnes réponses." },
  { icone: ToggleLeft, couleur: "bg-menthe/12 text-menthe-fonce", titre: "Vrai / Faux", texte: "Une affirmation à juger : vrai ou faux, en deux gros boutons." },
  { icone: TextCursorInput, couleur: "bg-azur/12 text-azur", titre: "Texte à trous", texte: "Des mots à retrouver, en saisie libre ou avec une banque de mots." },
  { icone: ArrowUpDown, couleur: "bg-lilas/12 text-lilas", titre: "Remise en ordre", texte: "Replacer les événements du récit, du début à la morale." },
  { icone: Link2, couleur: "bg-ambre/18 text-ambre-fonce", titre: "Association", texte: "Relier personnages et caractéristiques, mots et définitions." },
  { icone: PenLine, couleur: "bg-rose/12 text-rose", titre: "Question ouverte", texte: "Une réponse rédigée, corrigée automatiquement ou par l'enseignant." },
  { icone: Clapperboard, couleur: "bg-azur/12 text-azur", titre: "Vidéo interactive", texte: "La vidéo se met en pause et pose une question à l'élève." },
  { icone: PuzzleIcon, couleur: "bg-menthe/12 text-menthe-fonce", titre: "Activité H5P", texte: "Intégrez vos activités H5P (h5p.org, Lumi) dans la fable." },
];

const etapes = [
  {
    numero: "1",
    icone: PencilRuler,
    couleur: "bg-rose text-white",
    titre: "L'enseignant crée",
    texte: "Le texte de la fable, la morale, une illustration, une vidéo… puis les exercices parmi 8 types, avec aperçu immédiat.",
  },
  {
    numero: "2",
    icone: Ticket,
    couleur: "bg-menthe text-white",
    titre: "Les élèves rejoignent",
    texte: "Un code de classe suffit : pseudo, code secret, et l'élève est rattaché à son enseignant. Aucun email demandé.",
  },
  {
    numero: "3",
    icone: BarChart3,
    couleur: "bg-azur text-white",
    titre: "Le suivi s'affiche",
    texte: "Scores, tentatives, temps passé, erreurs fréquentes : des tableaux et graphiques clairs, exportables en CSV.",
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
            <span className="grid size-10 place-items-center rounded-2xl bg-rose text-white shadow-carte">
              <BookOpenText className="size-5" strokeWidth={2.4} />
            </span>
            <span className="font-titre text-2xl font-bold tracking-tight">Fablio</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-bold text-encre-doux md:flex">
            <a href="#fonctionnement" className="transition-colors hover:text-rose">Fonctionnement</a>
            <a href="#exercices" className="transition-colors hover:text-rose">Exercices</a>
            <a href="#multimedia" className="transition-colors hover:text-rose">Multimédia</a>
            <a href="#suivi" className="transition-colors hover:text-rose">Suivi</a>
          </nav>
          <div className="flex items-center gap-2.5">
            {lienTableau ? (
              <Link href={lienTableau} className="btn-primaire">
                Mon espace <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link href="/connexion" className="btn-fantome hidden sm:inline-flex">Se connecter</Link>
                <Link href="/inscription" className="btn-primaire">
                  Commencer <Sparkles className="size-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ---------- Héros ---------- */}
      <section className="bg-arc-enfant relative">
        <div className="bg-points">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pt-14 pb-16 lg:grid-cols-[1fr_1.05fr] lg:pt-20 lg:pb-24">
            <div className="anim-apparition">
              <span className="badge border-2 border-rose/25 bg-white text-rose">
                <Heart className="size-3.5 fill-current" />
                Pour les écoliers de 7 à 10 ans
              </span>
              <h1 className="font-titre mt-6 text-5xl leading-[1.02] font-bold tracking-tight text-balance sm:text-6xl lg:text-[4.5rem]">
                Ouvre le livre,{" "}
                <span className="relative inline-block text-rose">
                  les animaux
                  <svg viewBox="0 0 200 14" className="absolute -bottom-2 left-0 w-full text-menthe" aria-hidden>
                    <path d="M4 10 C 40 3, 78 12, 104 8 S 168 3, 196 9" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                  </svg>
                </span>{" "}
                sortent !
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed font-semibold text-encre-doux">
                Fablio fait vivre les fables en classe : l&apos;enseignant crée ses histoires et
                ses exercices, les élèves lisent, écoutent, regardent et jouent — et chaque
                progrès est suivi.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/inscription?role=enseignant" className="btn-gomme inline-flex items-center gap-2 rounded-full bg-rose px-7 py-3.5 font-titre text-lg font-bold text-white">
                  <GraduationCap className="size-5.5" /> Je suis enseignant
                </Link>
                <Link href="/inscription?role=eleve" className="btn-gomme inline-flex items-center gap-2 rounded-full bg-menthe px-7 py-3.5 font-titre text-lg font-bold text-white">
                  <MousePointerClick className="size-5.5" /> Je suis élève
                </Link>
              </div>

              <dl className="mt-10 flex flex-wrap gap-x-9 gap-y-4">
                {[
                  ["8", "types d'exercices", "text-rose"],
                  ["100 %", "gratuit & libre", "text-menthe-fonce"],
                  ["0", "email pour l'élève", "text-azur"],
                ].map(([chiffre, legende, couleur]) => (
                  <div key={legende}>
                    <dt className="etiquette">{legende}</dt>
                    <dd className={`font-titre text-3xl font-bold ${couleur}`}>{chiffre}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Illustration : le livre d'où sortent les animaux */}
            <div className="anim-apparition relative" style={{ animationDelay: "0.15s" }}>
              <div className="relative">
                <div className="anim-flotter relative mx-auto max-w-xl">
                  <Image
                    src="/images/hero-livre-magique.png"
                    alt="Un grand livre ouvert d'où s'échappent joyeusement les animaux des fables"
                    width={900}
                    height={720}
                    priority
                    className="w-full drop-shadow-2xl"
                  />
                </div>

                <div
                  className="anim-flotter absolute top-2 -left-2 flex items-center gap-2.5 rounded-2xl border-2 border-encre/10 bg-white px-4 py-3 shadow-carte sm:-left-6"
                  style={{ "--rotation": "-4deg", animationDelay: "0.6s" } as React.CSSProperties}
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-menthe/15 text-menthe-fonce">
                    <Star className="size-5 fill-current" />
                  </span>
                  <div>
                    <p className="text-xs font-extrabold text-encre-doux">Le Corbeau et le Renard</p>
                    <p className="font-titre text-sm font-bold">Fable terminée · 10/10</p>
                  </div>
                </div>

                <div
                  className="anim-flotter absolute -right-1 bottom-8 flex items-center gap-2.5 rounded-2xl border-2 border-encre/10 bg-white px-4 py-3 shadow-carte sm:-right-4"
                  style={{ "--rotation": "3deg", animationDelay: "1.4s" } as React.CSSProperties}
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-azur/15 text-azur">
                    <Volume2 className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-extrabold text-encre-doux">Lecture à voix haute</p>
                    <p className="font-titre text-sm font-bold">Écoute la fable !</p>
                  </div>
                </div>

                <div
                  className="anim-flotter absolute -bottom-3 left-6 flex items-center gap-2.5 rounded-2xl border-2 border-encre/10 bg-white px-4 py-3 shadow-carte"
                  style={{ "--rotation": "-2deg", animationDelay: "2.1s" } as React.CSSProperties}
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-rose/15 text-rose">
                    <Ticket className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-extrabold text-encre-doux">Code de ma classe</p>
                    <p className="font-titre text-sm font-bold tracking-widest">CE2A-X7K2Q</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Bandeau défilant ---------- */}
      <div className="overflow-hidden border-y-2 border-encre/10 bg-gradient-to-r from-rose/15 via-menthe/15 to-azur/15 py-3.5">
        <div className="anim-defilement flex w-max items-center gap-8 pr-8">
          {[...fablesDefilantes, ...fablesDefilantes].map((titre, i) => (
            <span key={i} className="flex items-center gap-8 whitespace-nowrap">
              <span className="font-titre text-sm font-bold text-encre/70">{titre}</span>
              <Feather className="size-4 text-rose/70" />
            </span>
          ))}
        </div>
      </div>

      {/* ---------- Fonctionnement ---------- */}
      <section id="fonctionnement" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="etiquette text-rose">Fonctionnement</p>
          <h2 className="font-titre mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Trois étapes, une classe entière qui lit
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {etapes.map((etape, i) => (
            <article key={etape.numero} className="carte anim-apparition relative p-7" style={{ animationDelay: `${i * 0.12}s` }}>
              <span className={`font-titre absolute -top-5 right-6 grid size-11 place-items-center rounded-2xl text-xl font-bold shadow-carte ${etape.couleur}`}>
                {etape.numero}
              </span>
              <span className={`grid size-12 place-items-center rounded-2xl ${etape.couleur}`}>
                <etape.icone className="size-6" />
              </span>
              <h3 className="font-titre mt-5 text-2xl font-bold">{etape.titre}</h3>
              <p className="mt-2.5 leading-relaxed font-semibold text-encre-doux">{etape.texte}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Types d'exercices ---------- */}
      <section id="exercices" className="scroll-mt-24 border-y-2 border-encre/8 bg-papier-fonce/40 py-20 lg:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="etiquette text-rose">Boîte à outils</p>
            <h2 className="font-titre mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Huit façons de faire réfléchir les élèves
            </h2>
            <p className="mt-4 text-lg font-semibold text-encre-doux">
              Chaque exercice est paramétrable : consigne, points, feedback immédiat, tentatives —
              et prévisualisable avant publication.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {typesExercices.map((type, i) => (
              <article key={type.titre} className="carte anim-apparition group p-6 transition-transform duration-300 hover:-translate-y-1.5" style={{ animationDelay: `${i * 0.06}s` }}>
                <span className={`grid size-12 place-items-center rounded-2xl transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110 ${type.couleur}`}>
                  <type.icone className="size-6" />
                </span>
                <h3 className="font-titre mt-4 text-xl font-bold">{type.titre}</h3>
                <p className="mt-1.5 text-sm leading-relaxed font-semibold text-encre-doux">{type.texte}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Multimédia ---------- */}
      <section id="multimedia" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 lg:py-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="etiquette text-rose">Multimédia</p>
          <h2 className="font-titre mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Lire, écouter, regarder, manipuler
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icone: Volume2,
              fond: "from-azur to-azur-fonce",
              titre: "La fable lue à voix haute",
              texte: "Un bouton « Écouter » sur chaque fable : la synthèse vocale lit le texte en français, à la vitesse choisie. Idéal pour les lecteurs débutants ou dyslexiques.",
            },
            {
              icone: Clapperboard,
              fond: "from-rose to-rose-fonce",
              titre: "Vidéos interactives",
              texte: "Ajoutez une vidéo YouTube, Vimeo, Drive ou MP4. L'enseignant place des questions à des instants précis : la vidéo se met en pause et l'élève doit répondre.",
            },
            {
              icone: PuzzleIcon,
              fond: "from-menthe to-menthe-fonce",
              titre: "Activités H5P",
              texte: "Réutilisez vos activités H5P existantes (h5p.org, Lumi) : collez le code d'intégration, l'activité s'affiche dans la fable et entre dans le suivi.",
            },
          ].map((bloc, i) => (
            <article key={bloc.titre} className={`anim-apparition rounded-3xl bg-gradient-to-br ${bloc.fond} p-7 text-white shadow-carte`} style={{ animationDelay: `${i * 0.1}s` }}>
              <span className="grid size-12 place-items-center rounded-2xl bg-white/20">
                <bloc.icone className="size-6" />
              </span>
              <h3 className="font-titre mt-5 text-2xl font-bold">{bloc.titre}</h3>
              <p className="mt-2 leading-relaxed font-semibold text-white/85">{bloc.texte}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Suivi statistique ---------- */}
      <section id="suivi" className="scroll-mt-24 border-y-2 border-encre/8 bg-papier-fonce/40 py-20 lg:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
          <div>
            <p className="etiquette text-rose">Suivi statistique</p>
            <h2 className="font-titre mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Comprendre où chaque élève en est
            </h2>
            <ul className="mt-8 space-y-5">
              {[
                { icone: Users, style: "bg-rose/12 text-rose", titre: "Par élève", texte: "Fables complétées, score moyen, temps passé, tentatives et progression jour après jour." },
                { icone: BarChart3, style: "bg-menthe/12 text-menthe-fonce", titre: "Par fable et par exercice", texte: "Taux de réussite, répartition des réponses au QCM, mots les plus souvent manqués." },
                { icone: FileDown, style: "bg-azur/12 text-azur", titre: "Export des données", texte: "Un clic pour obtenir toutes les réponses en CSV (Excel) ou imprimer le rapport en PDF." },
                { icone: ShieldCheck, style: "bg-lilas/12 text-lilas", titre: "Sécurité pensée pour l'école", texte: "Mots de passe hachés, sessions sécurisées, accès strictement réservé à chaque rôle." },
              ].map((point) => (
                <li key={point.titre} className="flex gap-4">
                  <span className={`mt-0.5 grid size-11 shrink-0 place-items-center rounded-2xl ${point.style}`}>
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

          <div className="carte anim-apparition overflow-hidden" style={{ animationDelay: "0.1s" }}>
            <div className="flex items-center justify-between border-b-2 border-encre/8 bg-papier px-6 py-4">
              <p className="font-titre font-bold">Taux de réussite par exercice</p>
              <span className="badge bg-menthe/12 text-menthe-fonce">CE2 · Semaine 12</span>
            </div>
            <div className="space-y-5 px-6 py-6">
              {[
                ["QCM — Qui travaille tout l'été ?", 86, "bg-menthe"],
                ["Vrai/Faux — La cigale a dansé", 92, "bg-azur"],
                ["Texte à trous — « fort {dépourvue} »", 58, "bg-rose"],
                ["Vidéo interactive — la course", 74, "bg-lilas"],
                ["Association mots ↔ définitions", 81, "bg-ambre"],
              ].map(([label, val, couleur]) => (
                <div key={label as string}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-bold">{label}</span>
                    <span className="font-titre shrink-0 font-bold text-encre-doux">{val} %</span>
                  </div>
                  <div className="h-3.5 overflow-hidden rounded-full bg-encre/8">
                    <div className={`h-full rounded-full ${couleur}`} style={{ width: `${val}%` }} />
                  </div>
                </div>
              ))}
              <p className="rounded-2xl bg-azur/10 px-4 py-3 text-sm font-bold text-azur-fonce">
                Erreur fréquente : « dépourvue » est souvent écrit « depourvu » (8 élèves sur 24).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Citation ---------- */}
      <section className="px-5 py-20">
        <figure className="carte bg-points relative mx-auto max-w-3xl overflow-hidden px-8 py-12 text-center">
          <Quote className="mx-auto size-10 rotate-180 text-rose/40" aria-hidden />
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
        <div className="bg-points-clair relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-rose via-[#b45ac0] to-azur px-8 py-16 text-center text-white sm:px-16">
          <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-white/20">
            <Rocket className="size-8" />
          </span>
          <h2 className="font-titre mx-auto mt-6 max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Prêt à faire entrer les fables dans votre classe ?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg font-semibold text-white/85">
            Créez votre compte en une minute, générez le code de votre classe, et laissez les
            histoires faire le reste.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/inscription?role=enseignant" className="btn bg-white px-7 py-3.5 text-base text-rose hover:bg-white/90">
              <GraduationCap className="size-5" /> Créer mon espace enseignant
            </Link>
            <Link href="/connexion" className="btn border-2 border-white/40 px-7 py-3.5 text-base text-white hover:bg-white/15">
              J&apos;ai déjà un compte
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Pied de page ---------- */}
      <footer className="border-t-2 border-encre/8 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-5 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-rose text-white">
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
