import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: 'node',
    // Integration files share one server and one database, and the first of them creates the owner.
    fileParallelism: false,
  },
})
