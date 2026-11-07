import { defineConfig } from "vitest/config";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// Always load the test environment before importing application modules
config({
  path: fileURLToPath(new URL("./.env.test", import.meta.url)),
  override: true,
});

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
