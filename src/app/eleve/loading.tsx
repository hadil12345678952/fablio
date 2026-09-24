/** Squelette de chargement de l'espace élève : structure identique au contenu
 *  final pour éviter tout saut visuel (léger, sans animation coûteuse). */
export default function ChargementEleve() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Chargement en cours">
      <div className="anim-pulser rounded-[2rem] border-2 border-encre/8 bg-papier-fonce/60 px-6 py-8">
        <div className="h-3 w-28 rounded-full bg-encre/10" />
        <div className="mt-3 h-9 w-72 max-w-full rounded-2xl bg-encre/10" />
        <div className="mt-3 h-4 w-56 max-w-full rounded-full bg-encre/8" />
      </div>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="anim-pulser h-28 rounded-3xl bg-papier-fonce/70" />
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="anim-pulser h-72 rounded-3xl bg-papier-fonce/60" />
        ))}
      </div>
    </div>
  );
}
