import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta contra o sistema de verdade: precisam do backend (perfil dev, em :8080) e de um
 * MySQL no ar. O frontend sobe sozinho, a menos que já exista um em E2E_BASE_URL. Ver README.md.
 */
export default defineConfig({
  testDir: "./e2e",
  // Os testes compartilham um banco real e algumas listagens são globais: um de cada vez.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", testIgnore: /mobile\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    // Chromium com viewport/toque de celular (o critério de aceite da spec é 375px e 390px).
    { name: "mobile", testMatch: /mobile\.spec\.ts/, use: { ...devices["Pixel 5"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: "http://localhost:3000/login", reuseExistingServer: true, timeout: 120_000 },
});
