"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

const CORAIL = "#E4572E";
const SARCELLE = "#2F7D6B";
const AMBRE = "#F2A93B";
const ENCRE = "#29231C";

const styleTooltip: React.CSSProperties = {
  borderRadius: "0.9rem",
  border: "2px solid rgba(41,35,28,0.12)",
  background: "white",
  fontFamily: "var(--font-corps)",
  fontWeight: 700,
  fontSize: "0.82rem",
  boxShadow: "0 10px 24px -12px rgba(41,35,28,0.3)",
};

export interface PointActivite {
  jour: string;
  tentatives: number;
  moyenne: number | null;
}

/** Activité des 14 derniers jours : tentatives (aire) + score moyen (courbe). */
export function CourbeActivite({ donnees }: { donnees: PointActivite[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={donnees} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(41,35,28,0.08)" vertical={false} />
        <XAxis
          dataKey="jour"
          tick={{ fontSize: 10.5, fontWeight: 700, fill: "rgba(41,35,28,0.55)" }}
          tickLine={false}
          axisLine={{ stroke: "rgba(41,35,28,0.15)" }}
          interval="preserveStartEnd"
          minTickGap={28}
        />
        <YAxis
          yAxisId="gauche"
          allowDecimals={false}
          tick={{ fontSize: 10.5, fontWeight: 700, fill: "rgba(41,35,28,0.55)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="droite"
          orientation="right"
          domain={[0, 100]}
          tick={{ fontSize: 10.5, fontWeight: 700, fill: "rgba(41,35,28,0.4)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v}%`}
          width={36}
        />
        <Tooltip contentStyle={styleTooltip} />
        <Area
          yAxisId="gauche"
          type="monotone"
          dataKey="tentatives"
          name="Tentatives"
          stroke={CORAIL}
          fill={CORAIL}
          fillOpacity={0.12}
          strokeWidth={2.5}
        />
        <Line
          yAxisId="droite"
          type="monotone"
          dataKey="moyenne"
          name="Score moyen (%)"
          stroke={SARCELLE}
          strokeWidth={2.5}
          dot={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Barres horizontales de taux (0-100 %) avec couleur selon le niveau. */
export function BarresTaux({
  donnees,
}: {
  donnees: { nom: string; taux: number }[];
}) {
  const hauteur = Math.max(180, donnees.length * 46 + 20);
  return (
    <ResponsiveContainer width="100%" height={hauteur}>
      <BarChart
        data={donnees}
        layout="vertical"
        margin={{ top: 0, right: 34, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(41,35,28,0.08)" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="nom"
          width={170}
          tick={{ fontSize: 11.5, fontWeight: 700, fill: ENCRE }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={styleTooltip}
          formatter={(value) => [`${value} %`, "Taux de réussite"]}
        />
        <Bar dataKey="taux" name="Taux de réussite" radius={[4, 10, 10, 4]} maxBarSize={22}>
          {donnees.map((d, i) => (
            <Cell
              key={i}
              fill={d.taux >= 75 ? SARCELLE : d.taux >= 50 ? AMBRE : CORAIL}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Distribution des choix (QCM, vrai/faux) — la bonne réponse en vert. */
export function BarresChoix({
  donnees,
}: {
  donnees: { etiquette: string; nombre: number; correct: boolean }[];
}) {
  const hauteur = Math.max(160, donnees.length * 52 + 20);
  return (
    <ResponsiveContainer width="100%" height={hauteur}>
      <BarChart
        data={donnees}
        layout="vertical"
        margin={{ top: 0, right: 30, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(41,35,28,0.08)" horizontal={false} />
        <XAxis type="number" allowDecimals={false} hide />
        <YAxis
          type="category"
          dataKey="etiquette"
          width={200}
          tick={{ fontSize: 11.5, fontWeight: 700, fill: ENCRE }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip contentStyle={styleTooltip} formatter={(v) => [`${v} élève(s)`, "Choix"]} />
        <Bar dataKey="nombre" name="Choix" radius={[4, 10, 10, 4]} maxBarSize={24}>
          {donnees.map((d, i) => (
            <Cell key={i} fill={d.correct ? SARCELLE : "rgba(41,35,28,0.35)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Petites barres verticales colorées (synthèse par fable). */
export function BarresFables({
  donnees,
}: {
  donnees: { titre: string; taux: number; tentatives: number }[];
}) {
  if (donnees.length === 0) return null;
  const raccourcies = donnees.map((d) => ({
    ...d,
    nom: d.titre.length > 22 ? d.titre.slice(0, 21) + "…" : d.titre,
  }));
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={raccourcies} margin={{ top: 10, right: 6, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(41,35,28,0.08)" vertical={false} />
        <XAxis
          dataKey="nom"
          tick={{ fontSize: 10.5, fontWeight: 700, fill: "rgba(41,35,28,0.55)" }}
          tickLine={false}
          axisLine={{ stroke: "rgba(41,35,28,0.15)" }}
          interval={0}
          angle={-18}
          textAnchor="end"
          height={58}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10.5, fontWeight: 700, fill: "rgba(41,35,28,0.55)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          contentStyle={styleTooltip}
          formatter={(value, name) =>
            name === "taux" ? [`${value} %`, "Réussite"] : [`${value}`, "Tentatives"]
          }
        />
        <Bar dataKey="taux" name="taux" radius={[8, 8, 4, 4]} maxBarSize={42}>
          {donnees.map((d, i) => (
            <Cell key={i} fill={d.taux >= 75 ? SARCELLE : d.taux >= 50 ? AMBRE : CORAIL} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
