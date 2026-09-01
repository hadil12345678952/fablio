"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpenText,
  Ticket,
  Users,
  BarChart3,
  Plug,
} from "lucide-react";

const LIENS = [
  { href: "/enseignant", label: "Tableau de bord", icone: LayoutDashboard, exact: true },
  { href: "/enseignant/fables", label: "Mes fables", icone: BookOpenText, exact: false },
  { href: "/enseignant/codes", label: "Codes de classe", icone: Ticket, exact: false },
  { href: "/enseignant/eleves", label: "Mes élèves", icone: Users, exact: false },
  { href: "/enseignant/statistiques", label: "Statistiques", icone: BarChart3, exact: false },
  { href: "/enseignant/integrations", label: "Moodle (LMS)", icone: Plug, exact: false },
];

export function NavEnseignant() {
  const chemin = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-4 lg:pb-0">
      {LIENS.map(({ href, label, icone: Icone, exact }) => {
        const actif = exact ? chemin === href : chemin.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              actif
                ? "bg-encre text-papier shadow-carte"
                : "text-encre-doux hover:bg-encre/5"
            }`}
          >
            <Icone className="size-4.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
