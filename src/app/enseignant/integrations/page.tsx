import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Plug,
  CheckCircle2,
  TriangleAlert,
  ExternalLink,
  BookOpenText,
  Users,
  KeyRound,
  FileText,
} from "lucide-react";
import { lireSession } from "@/lib/auth";
import { statutIntegrationMoodle } from "@/integrations/moodle";
import { BoutonsMoodle } from "@/components/enseignant/integrations-moodle";
import { etiquetteDateHeure } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Intégration Moodle" };

const CORRESPONDANCES = [
  ["Comptes (enseignant + élèves)", "Synchronisation plateforme", "Comptes Moodle (créés une fois, liés)"],
  ["Classes / codes de parrainage", "Un code = une classe", "Un cours Moodle « Fables françaises — … » par code"],
  ["Fables, auteurs, morale, niveaux", "Plateforme (métier)", "Référence dans le cours"],
  ["Exercices natifs (8 types)", "Plateforme (moteur + notation)", "Option : liaison vers un quiz Moodle existant"],
  ["Tentatives et notes Moodle", "Affichage dans Statistiques", "Source de vérité (Moodle)"],
  ["Tentatives et notes plateforme", "Plateforme (moteur local)", "—"],
];

export default async function PageIntegrations() {
  const session = await lireSession();
  if (!session || session.type !== "enseignant") redirect("/connexion?role=enseignant");
  const s = await statutIntegrationMoodle(session.enseignant.id);

  return (
    <div className="space-y-7">
      <div>
        <p className="etiquette text-lilas">Moteur pédagogique</p>
        <h1 className="font-titre mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          Intégration Moodle
        </h1>
        <p className="mt-1.5 max-w-3xl font-semibold text-encre-doux">
          Moodle devient votre moteur LMS (comptes, cours, quiz, tentatives, notes) ; Fablio
          reste l&apos;interface spécialisée pour l&apos;enseignement par les fables.
          L&apos;intégration est <strong>progressive et réversible</strong> : sans configuration,
          la plateforme fonctionne exactement comme avant.
        </p>
      </div>

      {/* ------ Configuration ------ */}
      <div className="carte p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-titre flex items-center gap-2 text-lg font-bold">
              <KeyRound className="size-5 text-lilas" /> Configuration serveur
            </p>
            {s.configure ? (
              <p className="mt-2 flex items-center gap-2 font-bold text-menthe-fonce">
                <CheckCircle2 className="size-5" />
                Moodle configuré sur <code className="rounded-lg bg-encre/5 px-2 py-0.5">{s.url}</code>
                <span className="text-xs font-semibold text-encre/45">
                  ({s.service} · jeton stocké côté serveur, jamais exposé au navigateur)
                </span>
              </p>
            ) : (
              <div className="mt-2 max-w-2xl">
                <p className="flex items-start gap-2 font-bold text-ambre-fonce">
                  <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                  Moodle n&apos;est pas configuré : la synchronisation est désactivée (mode
                  dégradé — tout le reste fonctionne normalement).
                </p>
                <p className="mt-2 font-mono text-xs font-semibold text-encre/60">
                  Ajoutez côté serveur (ex. Vercel → Environment Variables) :<br />
                  <code>MOODLE_URL=https://votre-moodle.tn</code>
                  <br />
                  <code>MOODLE_TOKEN=&lt;jeton du service web&gt;</code>
                  <br />
                  <code>MOODLE_SERVICE=&lt;nom du service externe&gt;</code>{" "}
                  <span className="font-sans">(optionnel)</span>
                </p>
                <p className="mt-2 text-xs font-semibold text-encre/50">
                  Instructions détaillées (activation des web services, création du jeton) :
                  fichier <code>MOODLE.md</code> à la racine du projet.
                </p>
              </div>
            )}
          </div>
          <span className={`badge ${s.configure ? "bg-menthe/12 text-menthe-fonce" : "bg-ambre/12 text-ambre-fonce"}`}>
            <Plug className="size-3.5" /> {s.configure ? "Connecteur actif" : "Inactif — mode dégradé"}
          </span>
        </div>
      </div>

      {/* ------ Actions ------ */}
      <div className="carte p-6">
        <p className="font-titre mb-1 text-lg font-bold">Synchronisation</p>
        <p className="mb-4 text-sm font-semibold text-encre/50">
          Idempotente : un compte et un cours ne sont jamais créés deux fois
          (mapping plateforme ↔ Moodle conservé en base).
        </p>
        <BoutonsMoodle />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-papier px-5 py-4">
            <p className="flex items-center gap-2 font-titre font-bold">
              <Users className="size-4.5 text-azur" /> Comptes liés
            </p>
            <p className="font-titre mt-1 text-2xl font-bold">
              {s.utilisateursLies} / {s.utilisateursTotal}
            </p>
            <p className="text-xs font-bold text-encre/45">
              Votre compte enseignant + vos élèves.
            </p>
          </div>
          <div className="rounded-2xl bg-papier px-5 py-4">
            <p className="flex items-center gap-2 font-titre font-bold">
              <BookOpenText className="size-4.5 text-rose" /> Cours Moodle liés
            </p>
            <p className="font-titre mt-1 text-2xl font-bold">{s.coursLiens.length}</p>
            <p className="text-xs font-bold text-encre/45">Un cours par classe (code).</p>
          </div>
        </div>

        {s.coursLiens.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="entree-table min-w-[560px]">
              <thead>
                <tr className="border-b-2 border-encre/8 text-left">
                  <th className="etiquette px-3 py-2">Classe (plateforme)</th>
                  <th className="etiquette px-3 py-2">Cours Moodle</th>
                  <th className="etiquette px-3 py-2 text-right">ID Moodle</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-encre/5">
                {s.coursLiens.map((c) => (
                  <tr key={c.codeId}>
                    <td className="px-3 py-2.5 font-extrabold">{c.etiquette || c.code}</td>
                    <td className="px-3 py-2.5 font-semibold text-encre/60">{c.titreCours}</td>
                    <td className="px-3 py-2.5 text-right font-bold">{c.moodleCourseId}</td>
                    <td className="px-3 py-2.5 text-right">
                      {s.url && (
                        <a
                          href={`${s.url}/course/view.php?id=${c.moodleCourseId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ligne px-3 py-1 text-xs"
                        >
                          <ExternalLink className="size-3.5" /> Ouvrir dans Moodle
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------ Correspondance des données ------ */}
      <div className="carte overflow-hidden">
        <div className="border-b-2 border-encre/8 bg-papier px-6 py-4">
          <p className="font-titre text-lg font-bold">Qui détient quoi ? (séparation des responsabilités)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="entree-table min-w-[680px]">
            <thead>
              <tr className="border-b-2 border-encre/8 text-left">
                <th className="etiquette px-6 py-3">Fonction</th>
                <th className="etiquette px-4 py-3">Plateforme Fablio</th>
                <th className="etiquette px-4 py-3">Moodle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-encre/5">
              {CORRESPONDANCES.map(([fonction, plateforme, moodle], i) => (
                <tr key={i}>
                  <td className="px-6 py-3 font-extrabold">{fonction}</td>
                  <td className="px-4 py-3 font-semibold text-menthe-fonce">{plateforme}</td>
                  <td className="px-4 py-3 font-semibold text-lilas">{moodle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="flex items-start gap-2 px-6 py-4 text-sm font-semibold text-encre/50">
          <FileText className="mt-0.5 size-4 shrink-0" />
          Lier un exercice à un quiz Moodle : éditez l&apos;exercice → champ « Lien avec un quiz
          Moodle » → indiquez l&apos;ID numérique du quiz. Voir <code>MOODLE.md</code> pour les
          limites du protocole de web services (création de quiz et tentatives depuis le jeton).
        </p>
      </div>

      {/* ------ Journal ------ */}
      <div className="carte overflow-hidden">
        <div className="border-b-2 border-encre/8 bg-papier px-6 py-4">
          <p className="font-titre text-lg font-bold">Journal des opérations</p>
        </div>
        {s.journal.length === 0 ? (
          <p className="px-6 py-8 text-center font-semibold text-encre/45">
            Aucune opération pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-encre/5">
            {s.journal.map((j) => (
              <li key={j.id} className="px-6 py-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`badge ${
                      j.statut === "ok"
                        ? "bg-menthe/12 text-menthe-fonce"
                        : j.statut === "erreur"
                          ? "bg-corail/10 text-corail"
                          : "bg-azur/10 text-azur"
                    }`}
                  >
                    {j.operation}
                  </span>
                  <span className="text-sm font-bold">{j.message}</span>
                  <span className="ml-auto text-xs font-semibold text-encre/40">
                    {etiquetteDateHeure(new Date(j.dateISO))}
                  </span>
                </div>
                {j.details && (
                  <pre className="mt-1.5 overflow-x-auto rounded-xl bg-papier px-3 py-2 text-[11px] font-semibold text-encre/60 whitespace-pre-wrap">
                    {j.details}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-sm font-semibold text-encre/45">
        Besoin d&apos;aide ? Consultez <Link href="/enseignant/statistiques" className="text-rose underline underline-offset-4">les statistiques</Link> et
        le guide <code>MOODLE.md</code> (réversible : supprimez simplement les variables pour tout désactiver).
      </p>
    </div>
  );
}
