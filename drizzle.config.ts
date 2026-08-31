import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// L'URL est lue depuis la variable d'environnement DATABASE_URL (ou le
// fichier .env en local). Pour pousser le schéma vers Neon depuis votre
// machine : DATABASE_URL="postgresql://…neon.tech/neondb?…" npx drizzle-kit push
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
