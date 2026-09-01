"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LoaderCircle,
  Plug,
  CheckCircle2,
  TriangleAlert,
  RefreshCw,
  Play,
} from "lucide-react";

type ResultatTest =
  | { ok: true; site: { nom: string; version: string; utilisateurToken: string } }
  | { ok: false; message: string };

interface Resume {
  configure: boolean;
  utilisateurs: { lies: number; nouveaux: number; erreurs: string[] };
  cours: { synchronises: number; erreurs: string[] };
}

export function BoutonsMoodle() {
  const [test, setTest] = useState<ResultatTest | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [enCours, setEnCours] = useState<"test" | "sync" | null>(null);
  const router = useRouter();

  async function appeler(url: string): Promise<void> {
    try {
      const res = await fetch(url, { method: "POST" });
      const json = await res.json();
      if (url.includes("tester")) setTest(json.resultat ?? null);
      else {
        setResume(json.resume ?? null);
        router.refresh();
      }
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          className="btn-ligne"
          disabled={enCours !== null}
          onClick={() => {
            setEnCours("test");
            void appeler("/api/integrations/moodle/tester");
          }}
        >
          {enCours === "test" ? (
            <LoaderCircle className="size-4.5 animate-spin" />
          ) : (
            <Plug className="size-4.5" />
          )}
          Tester la connexion
        </button>
        <button
          type="button"
          className="btn-primaire"
          disabled={enCours !== null}
          onClick={() => {
            setEnCours("sync");
            void appeler("/api/integrations/moodle/synchroniser");
          }}
        >
          {enCours === "sync" ? (
            <LoaderCircle className="size-4.5 animate-spin" />
          ) : (
            <RefreshCw className="size-4.5" />
          )}
          Synchroniser comptes, cours et inscriptions
        </button>
      </div>

      {test && (
        <div
          className={`anim-apparition flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold ${
            test.ok ? "bg-menthe/12 text-menthe-fonce" : "bg-ambre/12 text-ambre-fonce"
          }`}
        >
          {test.ok ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          ) : (
            <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          )}
          <span>
            {test.ok ? (
              <>
                Connexion établie avec « {test.site.nom} » ({test.site.version}).
                <span className="block text-xs">
                  Jeton valide — utilisé par « {test.site.utilisateurToken} ».
                </span>
              </>
            ) : (
              test.message
            )}
          </span>
        </div>
      )}

      {resume && (
        <div
          className={`anim-apparition rounded-2xl px-4 py-3.5 text-sm font-bold ${
            resume.configure ? "bg-azur/10 text-azur-fonce" : "bg-ambre/12 text-ambre-fonce"
          }`}
        >
          <p className="flex items-center gap-2">
            <Play className="size-4" />
            {resume.configure
              ? `Synchronisation terminée : ${resume.utilisateurs.lies} compte(s) lié(s), ${resume.utilisateurs.nouveaux} nouveau(x), ${resume.cours.synchronises} cours synchronisé(s).`
              : "Synchronisation impossible : Moodle n'est pas configuré."}
          </p>
          {[...resume.utilisateurs.erreurs, ...resume.cours.erreurs].length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs">
              {[...resume.utilisateurs.erreurs, ...resume.cours.erreurs].map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
