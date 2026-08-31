import { Fragment, type ReactNode } from "react";

// Rendu léger de la mise en forme simple : **gras**, *italique*, paragraphes.
// Le texte provient de l'enseignant et n'est jamais interprété comme du HTML.

function rendreInline(ligne: string, clePrefixe: string): ReactNode[] {
  const morceaux = ligne.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return morceaux.map((m, i) => {
    const cle = `${clePrefixe}-${i}`;
    if (m.startsWith("**") && m.endsWith("**") && m.length > 4) {
      return (
        <strong key={cle} className="font-extrabold">
          {m.slice(2, -2)}
        </strong>
      );
    }
    if (m.startsWith("*") && m.endsWith("*") && m.length > 2) {
      return <em key={cle}>{m.slice(1, -1)}</em>;
    }
    return <Fragment key={cle}>{m}</Fragment>;
  });
}

export function TexteRiche({ texte, className = "" }: { texte: string; className?: string }) {
  const paragraphes = texte.split(/\n{2,}/).filter((p) => p.trim() !== "");
  return (
    <div className={className}>
      {paragraphes.map((p, i) => {
        const lignes = p.split("\n");
        return (
          <p key={i} className="mb-4 last:mb-0">
            {lignes.map((ligne, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {rendreInline(ligne, `${i}-${j}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
