import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// MSG-25: unit and component tests. `npm test` (also run by CI) / `npm run test:watch`.
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true }, // "@/..." imports, as in the app
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    restoreMocks: true,
  },
});
