import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/test/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    environment: "node",
    globals: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
