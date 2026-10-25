import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Roteiros de teste em CommonJS (Playwright via require).
  {
    files: ["tests/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Sobras do template de monorepo do Replit: não fazem parte do app Next.
    "artifacts/**",
    "lib/**",
    // (o scripts/gerar-biblioteca-exercicios.mjs é do app e entra no lint)
    "scripts/src/**",
    "attached_assets/**",
  ]),
]);

export default eslintConfig;
