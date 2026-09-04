import Image from "next/image";
import { Volume2, Clapperboard, Sparkles, Image as ImageIcon } from "lucide-react";
import type { BlocEnrichi } from "@/lib/blocs/queries";
import type { ContenuTexte, ContenuImage, ContenuAudio, ContenuVideo } from "@/lib/blocs/types";
import { TexteRiche } from "@/components/texte-riche";
import { JoueurExercice } from "@/components/exercice/joueur-exercice";
import { normaliserVideo } from "@/lib/medias";
import { LecteurVocal } from "@/components/lecteur-vocal";

// ---------------------------------------------------------------------------
// RENDERER PARTAGÉ — utilisé par la page élève ET l'aperçu enseignant.
// mode "eleve"  → exercices interactifs (mode="jeu")
// mode "apercu" → aperçu fidèle (exercices mode="apercu", pas d'édition)
// Un seul moteur de rendu, jamais deux.
// ---------------------------------------------------------------------------

export function RenduParcoursFable({
  blocs,
  mode,
  lectureVocaleTexte,
}: {
  blocs: BlocEnrichi[];
  mode: "eleve" | "apercu";
  /** Texte lu par la synthèse vocale (titre + textes concaténés + morale). */
  lectureVocaleTexte?: string;
}) {
  const visibles = blocs.filter((b) => b.visible);
  if (visibles.length === 0) {
    return (
      <div className="carte px-8 py-12 text-center">
        <p className="font-titre text-xl font-bold">Cette fable est en préparation.</p>
        <p className="mt-1.5 font-semibold text-encre-doux">Reviens un peu plus tard !</p>
      </div>
    );
  }

  // Premier bloc TEXTE visible : on y accroche la synthèse vocale (contexte fable).
  const indicePremierTexte = visibles.findIndex((b) => b.type === "texte");
  const nbExercices = visibles.filter((b) => b.type === "exercice").length;
  let compteurExercice = 0;

  return (
    <div className="space-y-6">
      {/* Séparateur décoratif billes des exercices */}
      {nbExercices > 0 && null}

      {visibles.map((b) => {
        switch (b.type) {
          case "texte": {
            const c = b.contenu as ContenuTexte;
            compteurExercice += 0;
            const estPremier = b.id === visibles[indicePremierTexte]?.id;
            return (
              <article key={b.id} className="carte overflow-hidden px-6 py-6 sm:px-10 sm:py-8">
                {b.titre && (
                  <h2 className="font-titre mb-4 text-2xl font-bold">{b.titre}</h2>
                )}
                {estPremier && lectureVocaleTexte && mode === "eleve" && (
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-azur/25 bg-azur/8 px-5 py-4">
                    <div>
                      <p className="font-titre text-lg font-bold">Tu préfères écouter ?</p>
                      <p className="text-sm font-semibold text-encre/55">
                        Appuie sur le bouton : la fable est lue à voix haute.
                      </p>
                    </div>
                    <LecteurVocal texte={lectureVocaleTexte} />
                  </div>
                )}
                <TexteRiche
                  texte={c.markdown}
                  className="font-lecture mx-auto max-w-2xl text-xl leading-loose font-medium text-encre sm:text-[1.35rem]"
                />
              </article>
            );
          }

          case "image": {
            const c = b.contenu as ContenuImage;
            return (
              <figure key={b.id} className="carte overflow-hidden">
                <div className="relative aspect-[16/8] overflow-hidden bg-gradient-to-br from-corail/10 via-ambre/10 to-sarcelle/10">
                  {c.url ? (
                    <Image
                      src={c.url}
                      alt={c.alt || "Illustration de la fable"}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 896px"
                    />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center">
                      <ImageIcon className="size-14 text-encre/12" />
                    </span>
                  )}
                </div>
                {(c.legende || b.titre) && (
                  <figcaption className="px-6 py-3 text-center text-sm font-semibold text-encre/60">
                    {c.legende || b.titre}
                  </figcaption>
                )}
              </figure>
            );
          }

          case "audio": {
            const c = b.contenu as ContenuAudio;
            return (
              <section key={b.id} className="carte flex flex-wrap items-center gap-4 px-5 py-5 sm:px-8 sm:py-6">
                <span className="grid size-13 place-items-center rounded-2xl bg-menthe/15 text-menthe-fonce">
                  <Volume2 className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-titre text-lg font-bold">
                    {c.titre || b.titre || "Écoute la fable"}
                  </p>
                  {c.description && (
                    <p className="mb-1 text-sm font-semibold text-encre/55">{c.description}</p>
                  )}
                  <audio controls src={c.url} className="mt-1.5 w-full max-w-md">
                    Ton navigateur ne supporte pas la lecture audio.
                  </audio>
                </div>
              </section>
            );
          }

          case "video": {
            const c = b.contenu as ContenuVideo;
            const v = normaliserVideo(c.url);
            if (v.fournisseur === "inconnu") return null;
            return (
              <section key={b.id} className="carte overflow-hidden">
                {(c.titre || b.titre) && (
                  <p className="font-titre flex items-center gap-2 px-6 pt-5 pb-2 text-lg font-bold">
                    <Clapperboard className="size-5 text-rose" />
                    {c.titre || b.titre}
                  </p>
                )}
                <div className="overflow-hidden rounded-b-3xl border-t border-encre/10 bg-encre">
                  <div className="aspect-video w-full">
                    {v.fournisseur === "fichier" ? (
                      <video controls playsInline src={v.urlFichier} className="size-full">
                        Ton navigateur ne peut pas lire cette vidéo.
                      </video>
                    ) : (
                      <iframe
                        src={v.urlIframe}
                        title={c.titre || "Vidéo de la fable"}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                        allowFullScreen
                        className="size-full"
                      />
                    )}
                  </div>
                </div>
                {c.description && (
                  <p className="px-6 py-3 text-sm font-semibold text-encre/60">{c.description}</p>
                )}
              </section>
            );
          }

          case "exercice": {
            compteurExercice += 1;
            if (!b.exerciceEleve && !b.exerciceEnseignant) return null;
            const exoEleve = b.exerciceEleve ?? {
              id: b.exerciceEnseignant!.id,
              type: b.exerciceEnseignant!.type,
              typeEtiquette: b.exerciceEnseignant!.typeEtiquette,
              consigne: b.exerciceEnseignant!.consigne,
              points: b.exerciceEnseignant!.points,
              feedbackCorrect: b.exerciceEnseignant!.feedbackCorrect,
              feedbackIncorrect: b.exerciceEnseignant!.feedbackIncorrect,
              payload: b.exerciceEnseignant!.payload,
              presentation: {},
              maxTentatives: b.exerciceEnseignant!.maxTentatives,
              tentativesUtilisees: 0,
              tentativesRestantes: null,
              meilleurScore: null,
              reussi: false,
            };
            return (
              <section key={b.id} className="carte overflow-hidden px-4 py-5 sm:px-8 sm:py-6">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="font-titre grid size-9 place-items-center rounded-xl bg-corail text-sm font-bold text-white">
                    {compteurExercice}
                  </span>
                  {(b.titre || b.exerciceEnseignant?.consigne) && (
                    <p className="font-titre text-lg font-bold">{b.titre}</p>
                  )}
                </div>
                <JoueurExercice
                  key={`${exoEleve.id}${mode === "eleve" ? `-t${exoEleve.tentativesUtilisees}` : ""}`}
                  exercice={exoEleve}
                  numero={mode === "eleve" ? compteurExercice : undefined}
                  mode={mode === "eleve" ? "jeu" : "apercu"}
                />
              </section>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
