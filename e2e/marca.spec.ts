import { expect, test } from "@playwright/test";

import { entrar } from "./helpers";

// Whitelabel por build (BRAND). O teste confere a marca em que o servidor foi construído: E2E_MARCA diz qual é
// (padrão: claudaccount). Para a marca de exemplo: BRAND=exemplo npm run dev -- -p 3100 e
// E2E_MARCA=exemplo E2E_BASE_URL=http://localhost:3100 npx playwright test marca.spec.ts
const ID = process.env.E2E_MARCA ?? "claudaccount";
const OUTRAS = ["claudaccount", "exemplo"].filter((m) => m !== ID);

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
}

async function nomesDe(id: string) {
  return (await import(`../src/brands/${id}/marca`)).marca.nome as string;
}

test.describe(`marca ${ID}`, () => {
  test("login: nome, título da aba, cor e raio da marca; nada de outra marca", async ({ page }) => {
    const { marca } = await import(`../src/brands/${ID}/marca`);
    await page.goto("/login");

    await expect(page).toHaveTitle(new RegExp(marca.nome));
    if (marca.logo) {
      await expect(page.getByRole("img", { name: marca.nome }).first()).toBeVisible();
    } else {
      await expect(page.getByText(marca.nome, { exact: true })).toBeVisible();
    }

    const botao = page.getByRole("button", { name: "Entrar" });
    await expect(botao).toHaveCSS("background-color", rgb(marca.cores.claro.accent));
    await expect(botao).toHaveCSS("color", rgb(marca.cores.claro.onAccent));
    await expect(page.locator("html")).toHaveCSS("background-color", rgb(marca.cores.claro.bg));
    await expect(page.locator("form")).toHaveCSS("border-top-left-radius", marca.raio);

    const html = await page.content();
    for (const outra of OUTRAS) expect(html, `sobrou a marca ${outra}`).not.toContain(await nomesDe(outra));
    if (marca.favicon) await expect(page.locator(`head link[rel="icon"][href^="${marca.favicon}"]`)).toHaveCount(1);
  });

  test("área logada: logo/nome no menu e assinatura Auttopus sempre presente", async ({ page }) => {
    const { marca } = await import(`../src/brands/${ID}/marca`);
    await entrar(page);

    const menu = page.getByRole("link", { name: marca.nome, exact: true }).first();
    await expect(menu).toBeVisible();
    await expect(page.locator("aside")).toHaveCSS("background-color", rgb(marca.cores.claro.sidebarBg));
    if (marca.logo) await expect(page.locator("aside img")).toHaveAttribute("src", marca.logo.sobreEscuro);

    // A assinatura da desenvolvedora não é da marca: aparece em toda instalação.
    await expect(page.getByText("Desenvolvido por", { exact: true })).toBeVisible();
    await expect(page.locator('footer [aria-label="Auttopus"]')).toBeVisible();
    for (const outra of OUTRAS) expect(await page.content()).not.toContain(await nomesDe(outra));
  });
});
