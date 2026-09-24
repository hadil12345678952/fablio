import {
  Feather,
  BookOpenText,
  Flame,
  Compass,
  Medal,
  Star,
  Crown,
  Lock,
} from "lucide-react";
import type { BadgeEleve } from "@/lib/eleve/tableau-de-bord";

// Icône par badge (la logique d'attribution vit côté serveur, données réelles).
const ICONES: Record<string, typeof Feather> = {
  premier_pas: Feather,
  petit_lecteur: BookOpenText,
  perseverant: Flame,
  explorateur: Compass,
  collectionneur: Medal,
  etoile_or: Star,
  champion: Crown,
};

export function GrilleBadges({
  badges,
  compact = false,
}: {
  badges: BadgeEleve[];
  compact?: boolean;
}) {
  const affiches = compact ? badges.filter((b) => b.obtenu).slice(0, 6) : badges;
  if (compact && affiches.length === 0) {
    return (
      <p className="rounded-2xl bg-papier px-5 py-4 text-sm font-bold text-encre/45">
        Tes premiers badges arrivent dès que tu réussis un exercice !
      </p>
    );
  }

  return (
    <div
      className={
        compact
          ? "flex flex-wrap gap-2.5"
          : "grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4"
      }
    >
      {affiches.map((b) => {
        const Icone = ICONES[b.cle] ?? Star;
        if (compact) {
          return (
            <span
              key={b.cle}
              title={b.description}
              className="flex items-center gap-2 rounded-full border-2 border-ambre/50 bg-gradient-to-b from-ambre/20 to-white px-3.5 py-1.5"
            >
              <Icone className="size-4 text-ambre-fonce" />
              <span className="font-titre text-sm font-bold">{b.nom}</span>
            </span>
          );
        }
        return (
          <div
            key={b.cle}
            className={`rounded-3xl border-3 p-4 text-center transition-all ${
              b.obtenu
                ? "border-ambre/50 bg-gradient-to-b from-ambre/15 to-white shadow-carte"
                : "border-encre/10 bg-encre/[0.03]"
            }`}
          >
            <span
              className={`mx-auto grid size-13 place-items-center rounded-2xl ${
                b.obtenu ? "bg-ambre text-white" : "bg-encre/10 text-encre/35"
              }`}
            >
              {b.obtenu ? <Icone className="size-6" /> : <Lock className="size-5" />}
            </span>
            <p className="font-titre mt-2.5 text-sm leading-tight font-bold">{b.nom}</p>
            <p className="mt-1 text-[11px] leading-tight font-bold text-encre/45">
              {b.description}
            </p>
            {!b.obtenu && (
              <>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-encre/10">
                  <div
                    className="h-full rounded-full bg-ambre/70"
                    style={{ width: `${Math.round(b.avancement * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] font-extrabold text-encre/40">{b.detail}</p>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
