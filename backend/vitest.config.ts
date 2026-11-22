import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.integration.test.ts", "node_modules/**"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["src/**/*.integration.test.ts"],
          globalSetup: ["src/test/globalSetup.ts"],
          setupFiles: ["src/test/setup.ts"],
          // Todos os arquivos usam o mesmo MySQL e o mesmo Redis.
          fileParallelism: false,
          // O bcrypt do cadastro (12 rodadas) é lento de propósito.
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
})