import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests colocalisés dans lib/ uniquement (cf. docs/specs/tests-ci-lib.md) :
    // pas de tests UI/E2E, la logique critique est pure et vit dans lib/.
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
