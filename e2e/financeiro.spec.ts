import { expect, test } from "@playwright/test";

import { dataRelativa, sessaoApi } from "./api";
import { entrar } from "./helpers";
import { agilizar, prepararCliente } from "./notas";

/**
 * Financeiro: guias em valor (do backend de verdade) e o que os clientes emitiram, lido do portal de Salvador. Na demonstração
 * a leitura do portal é simulada no navegador, então estes testes pedem o módulo de notas em modo "demo".
 */
test.skip(process.env.E2E_NOTAS === "api", "a leitura do portal é simulada: estes testes são do modo demo");
test.setTimeout(90_000);

test.beforeEach(async ({ page }) => {
  await agilizar(page);
  await entrar(page, "/financeiro");
});

test("mostra o resumo do mês e, por cliente, quanto está em aberto e quanto já venceu", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await api.criarGuia(cliente.id, "DAS vencido", 120.5, dataRelativa(-4));
  await api.criarGuia(cliente.id, "DAS do mês", 30, dataRelativa(20));
  await page.reload();

  await expect(page.getByRole("heading", { name: "Financeiro", level: 1 })).toBeVisible();
  const resumo = page.getByRole("region", { name: /^Resumo de / });
  await expect(resumo).toContainText("Guias em aberto");
  await expect(resumo).toContainText("Guias vencidas");
  await expect(resumo).toContainText("Emitido pelos clientes em");

  const linha = page.getByRole("row").filter({ has: page.getByRole("link", { name: cliente.nome }) });
  await expect(linha).toContainText("R$ 150,50");
  await expect(linha).toContainText("2 guias");
  await expect(linha).toContainText("R$ 120,50"); // o vencido
  await expect(linha).toContainText("Não consultado");

  // O cliente com guia vencida vem antes dos demais; o nome leva ao cadastro e o valor, às guias dele.
  await linha.getByRole("link", { name: /R\$ 150,50/ }).click();
  await expect(page).toHaveURL(new RegExp(`/guias\\?clienteId=${cliente.id}`));
});

test("o mês escolhido fica na URL e o painel leva ao financeiro", async ({ page }) => {
  const mes = page.getByLabel("Mês");
  const opcoes = mes.locator("option");
  await expect(opcoes).toHaveCount(12);
  const anterior = await opcoes.nth(2).getAttribute("value");
  await mes.selectOption(anterior);
  await expect(page).toHaveURL(new RegExp(`mes=${anterior}`));
  await expect(page.getByRole("region", { name: /^Resumo de / })).toBeVisible();
  await page.reload();
  await expect(mes).toHaveValue(anterior!);

  await page.goto("/painel");
  await expect(page.getByRole("link", { name: "Ver o financeiro" })).toBeVisible();
  await expect(page.getByText("Guias em aberto (valor)")).toBeVisible();
  await page.getByRole("link", { name: "Ver o financeiro" }).click();
  await expect(page.getByRole("heading", { name: "Financeiro", level: 1 })).toBeVisible();
});

test("consulta o portal de Salvador para todos os clientes, com confirmação, andamento e o resultado na tabela", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await prepararCliente(page, cliente, { canal: "MUNICIPAL_SALVADOR" });
  await page.goto("/financeiro");

  const portal = page.getByRole("region", { name: "Portal de Salvador" });
  await expect(portal).toContainText("0 de 1 clientes de Salvador já foram consultados");
  await portal.getByRole("button", { name: "Consultar o portal de todos" }).click();

  const dialogo = page.getByRole("dialog", { name: "Consultar o portal de todos os clientes?" });
  await expect(dialogo).toContainText("Só leitura: nada é emitido.");
  await expect(dialogo).toContainText("1 cliente será consultado — 1 captcha");
  await dialogo.getByRole("button", { name: "Consultar agora" }).click();

  await expect(portal.getByRole("progressbar", { name: "Andamento da consulta" })).toBeVisible();
  await expect(portal.getByRole("status")).toContainText("Consulta concluída", { timeout: 20_000 });
  await expect(portal.getByRole("list", { name: "Clientes da consulta" })).toContainText("Consultado");
  await expect(portal).toContainText("1 de 1 clientes de Salvador já foram consultados");

  const linha = page.getByRole("row").filter({ has: page.getByRole("link", { name: cliente.nome }) });
  await expect(linha).toContainText(/R\$\s[\d.]+,\d\d/);
  await expect(linha).not.toContainText("Não consultado");
  await expect(page.getByRole("region", { name: /^Resumo de / })).toContainText("1 de 1 clientes consultados");

  // Quem já foi consultado fica de fora por padrão: não há o que fazer, e o botão de confirmar avisa.
  await portal.getByRole("button", { name: "Consultar o portal de todos" }).click();
  await expect(dialogo).toContainText("0 clientes serão consultados");
  await expect(dialogo.getByRole("button", { name: "Consultar agora" })).toBeDisabled();
  await dialogo.getByLabel(/Só os que ainda não foram consultados/).uncheck();
  await expect(dialogo).toContainText("1 cliente será consultado");
  await dialogo.getByRole("button", { name: "Voltar" }).click();
});

test("cancelar a consulta em lote deixa os que faltavam como não tentados", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await prepararCliente(page, cliente, { canal: "MUNICIPAL_SALVADOR" });
  await page.goto("/financeiro");
  await page.addInitScript(() => localStorage.setItem("demo-notas:atraso", "60000")); // cada cliente "demora" bastante

  const portal = page.getByRole("region", { name: "Portal de Salvador" });
  await portal.getByRole("button", { name: "Consultar o portal de todos" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Consultar agora" }).click();
  await expect(portal.getByRole("status")).toContainText("Consultando o portal…");
  await portal.getByRole("button", { name: "Cancelar consulta" }).click();
  await expect(portal.getByRole("status")).toContainText("Consulta cancelada");
  await expect(portal.getByRole("list", { name: "Clientes da consulta" })).toContainText("Não tentado");
});

test("mostra a Selic usada nas estimativas e deixa o administrador buscar ou digitar um mês", async ({ page }) => {
  const selic = page.getByRole("region", { name: "Selic usada nas estimativas" });
  await expect(selic).toBeVisible();
  const meses = selic.getByRole("list", { name: "Selic por mês" }).getByRole("listitem");
  expect(await meses.count()).toBeGreaterThanOrEqual(6);
  await expect(meses.first()).toContainText("%");
  await expect(selic.getByRole("button", { name: "Buscar no Banco Central" })).toBeVisible(); // o usuário dos testes é ADMIN

  // Digitar a Selic de um mês: guarda e passa a valer como "Digitada" (usa 2019-02, que nenhuma conta dos testes atravessa).
  await expect(selic.getByLabel("Mês", { exact: true })).toBeVisible();
  await selic.getByLabel("Selic do mês (%)").fill("abc");
  await selic.getByRole("button", { name: "Salvar Selic" }).click();
  await expect(selic).toContainText("Informe a Selic do mês em %");
});
