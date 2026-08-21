import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Per node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md (Next.js's own
// documented setup for this version) — unit/component tests only (no async Server
// Component support in Vitest yet, per that same doc); anything needing a real Next.js
// render pipeline is out of scope for F02.
//
// `environment: "happy-dom"`, not the doc's suggested "jsdom" — this Node/npm combination
// hits a real jsdom bug (its `@asamuzakjp/css-color` dependency does `require()` on an
// ESM-only file, `ERR_REQUIRE_ESM`, unrelated to any code in this repo). happy-dom provides
// the same DOM-in-Node environment Testing Library needs without that dependency chain.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
