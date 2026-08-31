"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Medal } from "lucide-react";

const LIENS = [
  { href: "/eleve", label: "Mes fables", icone: House, exact: true },
  { href: "/eleve/profil", label: "Mon profil", icone: Medal, exact: false },
];

export function NavEleve() {
  const chemin = usePathname();
  return (
    <nav className="flex items-center gap-1.5">
      {LIENS.map(({ href, label, icone: Icone, exact }) => {
        const actif = exact ? chemin === href : chemin.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold transition-all ${
              actif ? "bg-encre text-papier shadow-carte" : "text-encre-doux hover:bg-encre/6"
            }`}
          >
            <Icone className="size-4.5" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
