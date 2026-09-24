import { BookOpenText } from "lucide-react";

/** État de chargement global — léger (aucune animation coûteuse). */
export default function Chargement() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6">
      <div className="text-center">
        <span className="anim-pulser mx-auto grid size-16 place-items-center rounded-3xl bg-rose/12 text-rose">
          <BookOpenText className="size-8" />
        </span>
        <p className="font-titre mt-4 text-xl font-bold">Un instant…</p>
        <p className="mt-1 font-semibold text-encre/50">La page se prépare.</p>
      </div>
    </div>
  );
}
