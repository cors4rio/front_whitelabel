import { expect, test } from "@playwright/test";

import { entrar, unico } from "./helpers";

test("o valor do plano aceita o formato brasileiro e o colado de planilha, sem multiplicar por mil", async ({ page }) => {
  await entrar(page, "/planos");

  // "199.90" é o jeito comum de vir de uma planilha; o parser antigo apagava o ponto e gravava R$ 19.990,00.
  for (const [digitado, esperado] of [
    ["199,90", "R$ 199,90"],
    ["199.90", "R$ 199,90"],
    ["1.234,56", "R$ 1.234,56"],
  ]) {
    const nome = `Plano ${unico()}`;
    await page.getByRole("button", { name: "Novo plano" }).first().click();
    await page.getByLabel("Nome").fill(nome);
    await page.getByLabel("Valor mensal (R$)").fill(digitado);
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: nome })).toContainText(esperado);
  }
});

test("valor inválido mostra o erro junto do campo e não cadastra", async ({ page }) => {
  await entrar(page, "/planos");
  await page.getByRole("button", { name: "Novo plano" }).first().click();
  await page.getByLabel("Nome").fill(`Plano ${unico()}`);
  await page.getByLabel("Valor mensal (R$)").fill("1,234");
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect(page.getByText(/Informe um valor válido, como 199,90/)).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Novo plano" })).toBeVisible();
});
