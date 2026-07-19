// ESLint 9 (flat config). `next lint` a disparu avec Next 16 : on invoque
// eslint directement (`npm run lint`), avec les presets Next officiels
// (flat config natif depuis eslint-config-next 16).
import { defineConfig } from "eslint/config";
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

export default defineConfig([
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // App en français : les apostrophes dans le JSX sont partout et légitimes.
      "react/no-unescaped-entities": "off",
      // Baseline au moment de l'adoption d'ESLint (#34) : ces règles pointent
      // du code préexistant. Warnings = visibles sans bloquer la CI ; à
      // resserrer en "error" au fil des nettoyages.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "next-env.d.ts",
      // Hors app Next : plugin TRMNL (Liquid/JS embarqué) et fonctions Deno.
      "trmnl-plugin/**",
      "supabase/functions/**",
    ],
  },
]);
