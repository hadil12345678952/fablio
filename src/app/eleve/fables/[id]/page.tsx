import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import {
  ArrowLeft,
  Quote,
  Sparkles,
  Volume2,
  Rabbit,
  Bird,
  Turtle,
  Clapperboard,
} from "lucide-react";
import { db } from "@/db";
import { fables } from "@/db/schema";
import { lireSession } from "@/lib/auth";
import { exercicesPourEleve } from "@/lib/queries";
import { TexteRiche } from "@/components/texte-riche";
import { JoueurExercice } from "@/components/exercice/joueur-exercice";
import { LecteurVocal } from "@/components/lecteur-vocal";
import { normaliserVideo } from "@/lib/medias";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Lecture de la fable" };

const DIFFICULTES: Record<string, { label: string; icone: typeof Rabbit }> = {
  facile: { label: "Facile", icone: Rabbit },
  moyen: { label: "Moyen", icone: Bird },
  difficile: { label: "Difficile", icone: Turtle },
};

export default async function PageFableEleve({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await lireSession();
  if (!session || session.type !== "eleve") redirect("/connexion?role=eleve");
  const eleve = session.eleve;
  const { id } = await params;

  const [fable] = await db
    .select()
    .from(fables)
    .where(
      and(
        eq(fables.id, id),
        eq(fables.enseignantId, eleve.enseignantId),
        eq(fables.publie, true)
      )
    )
    .limit(1);

  // Contrôle d'accès : fable publiée + affectation éventuelle au groupe de l'élève
  const cibles = fable?.cibleCodeIds ?? [];
  const visible =
    fable && (cibles.length === 0 || (eleve.codeId ? cibles.includes(eleve.codeId) : false));
  if (!visible) notFound();

  const exercices = await exercicesPourEleve(fable.id, eleve);
  const diff = DIFFICULTES[fable.difficulte] ?? DIFFICULTES.facile;
  const nbReussis = exercices.filter((e) => e.reussi).length;
  const video = normaliserVideo(fable.videoUrl);

  // Texte lu par la synthèse vocale : sans les marques de mise en forme.
  const texteALire = [fable.titre, fable.texte, fable.morale ? `Morale : ${fable.morale}` : ""]
    .filter(Boolean)
    .join(". ")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "");

  return (
    <div className="space-y-8">
      <div className="anim-apparition">
        <Link href="/eleve" className="btn-fantome -ml-3 mb-2">
          <ArrowLeft className="size-4" /> Retour à mes fables
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-titre text-4xl font-bold tracking-tight text-balance">{fable.titre}</h1>
          <span className="badge bg-encre/8 text-encre/55">
            <diff.icone className="size-3.5" /> {diff.label}
          </span>
        </div>
        <p className="mt-2 font-semibold text-encre-doux">
          Lis bien l&apos;histoire : les réponses des exercices s&apos;y cachent !
        </p>
      </div>

      {/* Lecture */}
      <article className="carte anim-apparition overflow-hidden" style={{ animationDelay: "0.06s" }}>
        {fable.imageUrl && (
          <div className="relative aspect-[16/6] overflow-hidden">
            <Image
              src={fable.imageUrl}
              alt={`Illustration de ${fable.titre}`}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 896px"
            />
          </div>
        )}
        <div className="p-6 sm:p-10">
          {/* Lecture à voix haute (synthèse vocale) */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-azur/25 bg-azur/8 px-5 py-4">
            <div>
              <p className="font-titre text-lg font-bold">Tu préfères écouter ?</p>
              <p className="text-sm font-semibold text-encre/55">
                Appuie sur le bouton : la fable est lue à voix haute.
              </p>
            </div>
            <LecteurVocal texte={texteALire} />
          </div>

          {/* Piste audio enregistrée par l'enseignant */}
          {fable.audioUrl && (
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-menthe/10 px-5 py-4">
              <Volume2 className="size-6 text-menthe-fonce" />
              <div className="min-w-0 flex-1">
                <p className="font-titre font-bold">La voix de ton enseignant</p>
                <audio controls src={fable.audioUrl} className="mt-1.5 w-full max-w-md">
                  Ton navigateur ne supporte pas la lecture audio.
                </audio>
              </div>
            </div>
          )}

          {/* Vidéo de la fable */}
          {video.fournisseur !== "inconnu" && (
            <div className="mb-7">
              <p className="font-titre mb-2.5 flex items-center gap-2 text-lg font-bold">
                <Clapperboard className="size-5 text-rose" /> Regarde la fable en vidéo
              </p>
              <div className="overflow-hidden rounded-3xl border-3 border-encre/12 bg-encre">
                <div className="aspect-video w-full">
                  {video.fournisseur === "fichier" ? (
                    <video controls playsInline src={video.urlFichier} className="size-full">
                      Ton navigateur ne peut pas lire cette vidéo.
                    </video>
                  ) : (
                    <iframe
                      src={video.urlIframe}
                      title={`Vidéo — ${fable.titre}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                      allowFullScreen
                      className="size-full"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
          <TexteRiche
            texte={fable.texte}
            className="font-lecture mx-auto max-w-2xl text-xl leading-loose font-medium text-encre sm:text-[1.35rem]"
          />
          {fable.morale && (
            <div className="mx-auto mt-8 max-w-2xl rounded-3xl border-3 border-dashed border-ambre/50 bg-ambre/10 px-6 py-5">
              <p className="etiquette mb-1.5 flex items-center gap-1.5 text-ambre-fonce">
                <Quote className="size-3.5 rotate-180" /> La morale
              </p>
              <p className="font-lecture text-xl leading-relaxed font-semibold text-encre">
                {fable.morale}
              </p>
            </div>
          )}
        </div>
      </article>

      {/* Exercices */}
      <div className="anim-apparition" style={{ animationDelay: "0.12s" }}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-titre flex items-center gap-2.5 text-3xl font-bold">
            <span className="grid size-12 place-items-center rounded-2xl bg-corail text-white">
              <Sparkles className="size-6" />
            </span>
            À toi de jouer !
          </h2>
          <span className="badge bg-sarcelle/12 px-4 py-2 text-sm text-sarcelle">
            {nbReussis} / {exercices.length} réussi(s)
          </span>
        </div>

        {exercices.length === 0 ? (
          <div className="carte px-8 py-12 text-center">
            <p className="font-titre text-xl font-bold">Pas encore d&apos;exercice ici.</p>
            <p className="mt-1.5 font-semibold text-encre-doux">
              Ton enseignant prépare sûrement la suite…
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {exercices.map((exercice, i) => (
              <JoueurExercice
                key={exercice.id}
                exercice={exercice}
                numero={i + 1}
                mode="jeu"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
