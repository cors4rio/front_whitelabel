import { expect, test } from "@playwright/test";

import { EMAIL, entrar, SENHA } from "./helpers";

test("área logada redireciona para o login e volta ao destino depois de entrar", async ({ page }) => {
  await page.goto("/clientes");
  await expect(page).toHaveURL(/\/login\?next=%2Fclientes/);

  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/clientes$/);
  await expect(page.getByRole("heading", { name: "Clientes", level: 1 })).toBeVisible();
});

test("senha errada mostra a mensagem do servidor e não entra", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill("senha-errada");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.locator("form").getByRole("alert")).toHaveText("E-mail ou senha incorretos.");
  await expect(page).toHaveURL(/\/login/);
});

test("não aceita redirecionamento para fora do sistema via ?next=", async ({ page }) => {
  await page.goto("/login?next=//exemplo.com");
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/localhost:3000\/painel/);
});

test("a sessão sobrevive a recarregar a página", async ({ page }) => {
  await entrar(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Painel", level: 1 })).toBeVisible();
});

test("sair volta ao login e a rota protegida passa a exigir login de novo", async ({ page }) => {
  await entrar(page);
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/clientes");
  await expect(page).toHaveURL(/\/login/);
});

test("várias abas abrindo ao mesmo tempo não derrubam a sessão (rotação do refresh token)", async ({ page, context }) => {
  await entrar(page);

  const [a, b, c] = await Promise.all([context.newPage(), context.newPage(), context.newPage()]);
  await Promise.all([a.goto("/painel"), b.goto("/clientes"), c.goto("/planos")]);

  await expect(a.getByRole("heading", { name: "Painel", level: 1 })).toBeVisible();
  await expect(b.getByRole("heading", { name: "Clientes", level: 1 })).toBeVisible();
  await expect(c.getByRole("heading", { name: "Planos", level: 1 })).toBeVisible();
});
