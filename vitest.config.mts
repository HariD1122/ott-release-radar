import path from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: loadEnv(mode, process.cwd(), ""), // picks up .env.local so integration tests can reach Neon
    testTimeout: 60_000,
  },
}));
