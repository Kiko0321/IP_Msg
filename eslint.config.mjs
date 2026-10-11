import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Electron's main process (desktop/, MSG-34) is plain CommonJS.
  { files: ["**/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist-desktop/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
