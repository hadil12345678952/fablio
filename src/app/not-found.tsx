import Link from "next/link";
import { Compass, House } from "lucide-react";

/** Page 404 — ton adapté aux enfants, sortie toujours proposée. */
export default function Introuvable() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-6">
      <div className="carte bg-points max-w-md p-8 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-azur/12 text-azur">
          <Compass className="size-8" />
        </span>
        <h1 className="font-titre mt-4 text-3xl font-bold">Page introuvable</h1>
        <p className="mt-2 font-semibold text-encre-doux">
          Cette page n&apos;existe pas ou n&apos;est plus disponible. Le renard a dû
          l&apos;emporter !
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primaire">
            <House className="size-4.5" /> Retour à l&apos;accueil
          </Link>
          <Link href="/eleve" className="btn-ligne">
            Mes fables
          </Link>
        </div>
      </div>
    </div>
  );
}
