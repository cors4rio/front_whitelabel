import { expect, test } from "@playwright/test";

import { mesRelativo, sessaoApi } from "./api";
import { entrar } from "./helpers";

test.setTimeout(90_000);

test.beforeEach(async ({ page }) => {
  await entrar(page, "/fator-r");
});

test("lista o cliente com o Fator R, o anexo e a base; abre o histórico e a correção de um mês muda o anexo", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  for (let i = 1; i <= 12; i++) await api.informarMesDoFatorR(cliente.id, mesRelativo(i), 3000, 10000); // 30%
  await page.reload();

  await expect(page.getByRole("heading", { name: "Fator R", level: 1 })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("28% ou mais");
  const linha = page.getByRole("row").filter({ has: page.getByRole("link", { name: cliente.nome }) });
  await expect(linha).toContainText("30,00%");
  await expect(linha).toContainText("Anexo III");
  await expect(linha).toContainText("12 meses");

  await linha.getByRole("link", { name: cliente.nome }).click();
  await expect(page).toHaveURL(new RegExp(`cliente=${cliente.id}`));
  const resumo = page.getByRole("region", { name: cliente.nome });
  await expect(resumo).toContainText("30,00%");
  await expect(resumo).toContainText("Anexo III");
  await expect(resumo).toContainText("12 meses");

  // Zera a folha do mês passado: 11 x 3.000 = 33.000 de 120.000 = 27,50% -> Anexo V, faltam R$ 600,00.
  const meses = page.getByRole("list", { name: "Meses" }).getByRole("listitem");
  await expect(meses).toHaveCount(24);
  const mesPassado = meses.nth(1);
  const salvar = mesPassado.getByRole("button", { name: /^Salvar / });
  await expect(salvar).toBeDisabled(); // nada mudou ainda
  await mesPassado.getByLabel(/^Folha de /).fill("0");
  await expect(salvar).toBeEnabled();
  await salvar.click();
  await expect(page.getByText(/ salvo$/)).toBeVisible();
  await expect(resumo).toContainText("27,50%");
  await expect(resumo).toContainText("Anexo V");
  await expect(resumo).toContainText("R$ 600,00");

  // Voltar para a lista mostra o novo anexo.
  await page.getByRole("link", { name: "Voltar para a lista" }).click();
  await expect(linha).toContainText("Anexo V");
  await expect(linha).toContainText("R$ 600,00");
});

test("acompanhar outro cliente: busca, base incompleta avisada, valor inválido recusado e mês apagado", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();

  await page.getByRole("combobox", { name: "Acompanhar outro cliente" }).fill(cliente.cpf);
  await page.getByRole("listbox", { name: "Clientes encontrados" }).getByRole("option", { name: new RegExp(cliente.nome) }).click();
  await expect(page).toHaveURL(new RegExp(`cliente=${cliente.id}`));
  const resumo = page.getByRole("region", { name: cliente.nome });
  await expect(resumo).toContainText("Sem base");

  const mesPassado = page.getByRole("list", { name: "Meses" }).getByRole("listitem").nth(1);
  await mesPassado.getByLabel(/^Folha de /).fill("abc");
  await mesPassado.getByRole("button", { name: /^Salvar / }).click();
  await expect(mesPassado.getByRole("alert")).toContainText("Use um valor em reais");

  await mesPassado.getByLabel(/^Folha de /).fill("3.000,00");
  await mesPassado.getByLabel(/^Receita de /).fill("10.000,00");
  await mesPassado.getByRole("button", { name: /^Salvar / }).click();
  await expect(resumo).toContainText("30,00%");
  await expect(resumo).toContainText("1 de 12 meses");
  await expect(resumo.getByRole("note")).toContainText("Base incompleta");

  // Dois campos vazios + salvar apaga o mês.
  const de_novo = page.getByRole("list", { name: "Meses" }).getByRole("listitem").nth(1);
  await de_novo.getByLabel(/^Folha de /).fill("");
  await de_novo.getByLabel(/^Receita de /).fill("");
  await de_novo.getByRole("button", { name: /^Salvar / }).click();
  await expect(page.getByText(/ apagado$/)).toBeVisible();
  await expect(resumo).toContainText("Sem base");
});

test("o mês de apuração fica na URL e muda a conta (usa os 12 meses anteriores a ele)", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  for (let i = 1; i <= 12; i++) await api.informarMesDoFatorR(cliente.id, mesRelativo(i), 1000, 10000); // 10%
  await page.goto(`/fator-r?cliente=${cliente.id}`);
  const resumo = page.getByRole("region", { name: cliente.nome });
  await expect(resumo).toContainText("10,00%");

  // Apurar há 6 meses: só os 6 meses de dados que o antecedem entram.
  await page.getByLabel("Mês de apuração").selectOption({ index: 6 });
  await expect(page).toHaveURL(/mes=\d{4}-\d{2}/);
  await expect(resumo).toContainText("6 de 12 meses");
});
