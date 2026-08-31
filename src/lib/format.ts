// Petits formateurs d'affichage partagés (purs, client & serveur).

export function formatScore(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function formatPct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${Math.round(n)} %`;
}

export function formatDuree(secondes: number | null | undefined): string {
  const s = Math.max(0, Math.round(secondes ?? 0));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const reste = s % 60;
  if (m < 60) return reste ? `${m} min ${reste} s` : `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

const formateurJour = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});
const formateurDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const formateurHeure = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function etiquetteJour(d: Date): string {
  return formateurJour.format(d);
}
export function etiquetteDate(d: Date): string {
  return formateurDate.format(d);
}
export function etiquetteDateHeure(d: Date): string {
  return formateurHeure.format(d);
}

export function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
