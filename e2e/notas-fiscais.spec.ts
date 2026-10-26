import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { sessaoApi } from "./api";
import { entrar } from "./helpers";
import {
  agilizar,
  cadastrarTomadorNaConfiguracao,
  detalhe,
  emitirNota,
  enviarCertificado,
  escolherMunicipio,
  escolherCliente,
  escolherServico,
  escolherTomador,
  lista,
  painelDoCliente,
  preencherNota,
  prepararCliente,
  salvarAcessoAoPortal,
  salvarDadosFiscais,
  secaoDoPainel,
  TOMADOR_PADRAO,
} from "./notas";

/**
 * Notas fiscais no modo "demo" (padrão do `npm run dev`): notas, dados fiscais e tomadores vêm da simulação no
 * navegador, enquanto clientes, login e o resto continuam usando o backend de verdade. Cada teste tem um navegador
 * novo, então começa nas 8 notas de exemplo (ids 1 a 8: ver lib/notas/demo/banco.ts), sem dados fiscais nem tomadores:
 * o teste que emite prepara o cliente pela própria tela (ver notas.ts).
 */

test.skip(process.env.E2E_NOTAS === "api", "este arquivo é da simulação no navegador; o modo api tem o seu (notas-fiscais-api.spec.ts)");

test.beforeEach(async ({ page }) => {
  test.setTimeout(60_000);
  await agilizar(page);
  await entrar(page, "/notas-fiscais");
});

test("lista as notas de exemplo, as mais recentes primeiro, cada uma com a situação em texto e o aviso de demonstração", async ({ page }) => {
  await expect(page.getByRole("region", { name: "Modo demonstração" })).toContainText("nada é enviado à Receita");
  await expect(page.getByText("Ambiente de homologação:")).toBeVisible();

  const notas = lista(page).getByRole("link");
  await expect(notas).toHaveCount(8);
  await expect(notas.first()).toContainText("Marina Ferraz Consultoria"); // a linha principal é o prestador
  await expect(notas.first()).toContainText("para Padaria Pão Quente Ltda"); // e o tomador vem em seguida
  await expect(notas.first()).toContainText("Rascunho");
  await expect(notas.first()).toContainText("competência"); // sem emissão, a data é a competência, dita como tal
  await expect(lista(page).getByText("Rejeitada", { exact: true })).toHaveCount(1);
  await expect(lista(page).getByText("Cancelada", { exact: true })).toHaveCount(1);
  await expect(lista(page).getByText("Autorizada", { exact: true })).toHaveCount(5);
  await expect(lista(page).getByText("Nº 44")).toBeVisible();
  await expect(lista(page).getByText("1–8 de 8")).toBeVisible();

  // Só uma ação primária por tela: "Emitir nota" (a configuração é secundária).
  await expect(page.getByRole("link", { name: "Emitir nota" })).toBeVisible();
  await expect(detalhe(page).getByText("Selecione uma nota")).toBeVisible();
});

test("filtra por situação, mês e busca (prestador ou tomador), e tudo fica na URL", async ({ page }) => {
  await page.getByLabel("Filtrar por situação").selectOption("REJEITADA");
  await expect(page).toHaveURL(/situacao=REJEITADA/);
  await expect(lista(page).getByRole("link")).toHaveCount(1);
  await expect(lista(page).getByRole("link")).toContainText("Thiago Salgado ME");

  await page.getByLabel("Filtrar por situação").selectOption("TODAS");
  await expect(page).not.toHaveURL(/situacao=/);
  await page.getByLabel("Filtrar por mês de competência").selectOption({ index: 1 }); // o mês atual
  await expect(page).toHaveURL(/mes=\d{4}-\d{2}/);
  await expect(lista(page).getByRole("link")).toHaveCount(5); // as de competência neste mês

  await page.getByRole("searchbox", { name: /Buscar por cliente/ }).fill("oliveira andrade");
  await expect(page).toHaveURL(/busca=oliveira/);
  await expect(lista(page).getByRole("link")).toHaveCount(1);

  // O tomador também é achado pela busca.
  await page.goto("/notas-fiscais?busca=joao%20pereira");
  await expect(lista(page).getByRole("link")).toHaveCount(2);
  await expect(lista(page).getByRole("link").first()).toContainText("Camila Prado");

  // O filtro vem da URL: um link direto abre a lista já filtrada, e "Limpar filtros" desfaz tudo.
  await page.goto("/notas-fiscais?situacao=CANCELADA");
  await expect(page.getByLabel("Filtrar por situação")).toHaveValue("CANCELADA");
  await expect(lista(page).getByRole("link")).toHaveCount(1);
  await page.goto("/notas-fiscais?busca=zzzinexistente");
  await expect(page.getByText("Nenhuma nota encontrada")).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(lista(page).getByRole("link")).toHaveCount(8);
});

test("emite uma nota com retenções federais: revisa, confirma, vê 'enviada', depois 'autorizada', e baixa o XML e o PDF", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await prepararCliente(page, cliente);
  await agilizar(page, 1800);

  await page.goto("/notas-fiscais?novo=1");
  await escolherCliente(page, cliente);
  await expect(page.getByText(/emite com certificado digital · Curitiba\/PR/)).toBeVisible();
  await escolherTomador(page);
  await expect(page.getByText("11.444.777/0001-61").first()).toBeVisible();
  await page.getByLabel("Valor do serviço (R$)").fill("1.800");
  await page.getByRole("button", { name: /^Usar “Honorários contábeis referentes a \d{2}\/\d{4}”$/ }).click();
  await expect(page.getByLabel("Descrição do serviço")).toHaveValue(/^Honorários contábeis referentes a \d{2}\/\d{4}$/);
  await page.getByText("Retenções federais (opcional)").click();
  await page.getByLabel("IRRF (R$)").fill("27");
  await page.getByLabel("PIS (R$)").fill("11,70");
  await page.getByRole("button", { name: "Revisar e emitir" }).click();

  // A revisão mostra o que vai na nota e o ambiente; o foco começa no botão seguro.
  const revisao = page.getByRole("dialog", { name: "Emitir a nota fiscal?" });
  await expect(revisao).toContainText("Ambiente de homologação");
  await expect(revisao).toContainText(cliente.nome);
  await expect(revisao).toContainText(TOMADOR_PADRAO.nome);
  await expect(revisao).toContainText("17.19.01");
  await expect(revisao).toContainText("R$ 1.800,00");
  await expect(revisao).toContainText("IRRF R$ 27,00 · PIS R$ 11,70");
  await expect(revisao).toContainText("Total retido R$ 38,70 · líquido a receber R$ 1.761,30");
  await expect(revisao.getByRole("button", { name: "Voltar e revisar" })).toBeFocused();
  await revisao.getByRole("button", { name: "Emitir nota" }).click();

  await expect(page).toHaveURL(/\/notas-fiscais\?id=\d+/);
  await expect(page.getByText("Nota enviada para autorização")).toBeVisible();
  await expect(detalhe(page).getByText("Enviada", { exact: true })).toBeVisible();
  await expect(detalhe(page).getByText("Aguardando o sistema nacional.")).toBeVisible();
  await expect(detalhe(page).getByRole("button", { name: "Atualizar situação" })).toBeVisible();
  // Enquanto espera, a nota não se edita.
  await expect(detalhe(page).getByLabel("Valor do serviço (R$)")).toHaveCount(0);

  // A tela se atualiza sozinha quando o sistema nacional responde.
  await expect(detalhe(page).getByText("Autorizada", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Nota emitida", { exact: true })).toBeVisible();
  await expect(detalhe(page).getByText("Aguardando o sistema nacional.")).toHaveCount(0);
  await expect(detalhe(page).getByRole("heading", { name: cliente.nome, level: 2 })).toBeVisible();
  await expect(detalhe(page).getByText("Número da NFS-e")).toBeVisible();
  await expect(detalhe(page).getByText(/^\d{4}( \d{4}){11} \d{2}$/)).toBeVisible(); // chave de 50 dígitos em blocos de 4
  await expect(detalhe(page).getByText("Homologação · sem validade fiscal")).toBeVisible();
  await expect(detalhe(page).getByText("Recolhido no DAS (Simples Nacional)")).toBeVisible();
  await expect(detalhe(page).getByText("Total retido R$ 38,70")).toBeVisible();
  await expect(detalhe(page).getByText("Sem certificado")).toHaveCount(0); // emitiu com certificado: sem aviso
  await expect(detalhe(page).getByRole("list", { name: "Linha do tempo da nota" }).getByRole("listitem")).toHaveText([/Rascunho criado/, /Enviada para autorização/, /Autorizada pelo sistema nacional/]);

  // Arquivos: baixa com o nome da nota; o conteúdo diz que é demonstração e leva as retenções.
  const [xml] = await Promise.all([page.waitForEvent("download"), detalhe(page).getByRole("button", { name: "Baixar XML" }).click()]);
  expect(xml.suggestedFilename()).toMatch(/^NFS-e \d+ - E2E Cliente .+\.xml$/);
  const conteudo = readFileSync((await xml.path())!, "utf8");
  expect(conteudo).toContain("DEMONSTRAÇÃO");
  expect(conteudo).toContain("vRetIRRF");
  const [pdf] = await Promise.all([page.waitForEvent("download"), detalhe(page).getByRole("button", { name: "Baixar PDF" }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  expect(readFileSync((await pdf.path())!).subarray(0, 5).toString("latin1")).toBe("%PDF-");

  // E a lista já mostra a nota nova no topo.
  await expect(lista(page).getByRole("link").first()).toContainText(cliente.nome);
  await expect(lista(page).getByRole("link").first()).toContainText(`para ${TOMADOR_PADRAO.nome}`);
  await expect(lista(page).getByRole("link").first()).toContainText("Autorizada");
});

test("o PDF também abre em outra aba, buscado com o login (como as guias)", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __abertos: string[] };
    w.__abertos = [];
    window.open = () => ({ location: { set href(v: string) { w.__abertos.push(v); } }, close() {}, opener: null }) as unknown as Window;
  });
  await page.goto("/notas-fiscais?id=4");
  await detalhe(page).getByRole("button", { name: "Mais ações da nota" }).click();
  await page.getByRole("menuitem", { name: "Abrir o PDF em outra aba" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __abertos: string[] }).__abertos.length)).toBe(1);
  const lido = await page.evaluate(async () => {
    const url = (window as unknown as { __abertos: string[] }).__abertos[0];
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    return { url: url.slice(0, 5), inicio: String.fromCharCode(...bytes.slice(0, 5)) };
  });
  expect(lido).toEqual({ url: "blob:", inicio: "%PDF-" });
});

test("valida o formulário: erro junto de cada campo, foco no primeiro inválido, retenções que passam do valor e data futura recusadas", async ({ page }) => {
  await page.goto("/notas-fiscais?novo=1");
  // O serviço de contabilidade já vem escolhido.
  await expect(page.getByRole("combobox", { name: "Serviço prestado" })).toHaveValue(/^17\.19\.01 · Contabilidade/);
  // O tomador é da lista do cliente: sem cliente, não há lista.
  await expect(page.getByRole("combobox", { name: "Tomador" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Novo tomador" })).toBeDisabled();

  await page.getByRole("button", { name: "Revisar e emitir" }).click();
  await expect(page.getByText("Escolha o cliente que emite a nota (o prestador do serviço)")).toBeVisible();
  await expect(page.getByText("Escolha o tomador: quem compra o serviço")).toBeVisible();
  await expect(page.getByText("Descreva o serviço prestado")).toBeVisible();
  await expect(page.getByText("Informe um valor válido, como 1.245,90")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Cliente (prestador)" })).toBeFocused();
  await expect(page.getByRole("dialog", { name: "Emitir a nota fiscal?" })).toBeHidden();

  // Corrigir um campo apaga o erro dele; limpar o serviço traz o erro dele.
  await page.getByLabel("Valor do serviço (R$)").fill("10");
  await expect(page.getByText("Informe um valor válido, como 1.245,90")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Serviço prestado" }).fill("xx");
  await page.getByLabel("Descrição do serviço").fill("Qualquer");
  await page.getByRole("button", { name: "Revisar e emitir" }).click();
  await expect(page.getByText("Escolha o serviço prestado")).toBeVisible();

  // Retenção com valor inválido ou que passa do valor do serviço.
  await page.getByText("Retenções federais (opcional)").click();
  await page.getByLabel("COFINS (R$)").fill("abc");
  await page.getByRole("button", { name: "Revisar e emitir" }).click();
  await expect(page.getByText(/COFINS: informe um valor válido/)).toBeVisible();
  await page.getByLabel("COFINS (R$)").fill("15");
  await page.getByRole("button", { name: "Revisar e emitir" }).click();
  await expect(page.getByText("A soma das retenções não pode passar do valor do serviço")).toBeVisible();

  await page.getByLabel("Data do serviço (competência)").fill("2999-01-01");
  await page.getByRole("button", { name: "Revisar e emitir" }).click();
  await expect(page.getByText(/A data não pode ser futura/)).toBeVisible();
});

test("o combobox de serviço acha por código e por palavra, e o contador de caracteres avisa do limite", async ({ page }) => {
  await page.goto("/notas-fiscais?novo=1");
  const servico = page.getByRole("combobox", { name: "Serviço prestado" });
  const opcoes = page.getByRole("listbox", { name: "Serviços da lista nacional" });

  await servico.fill("auditoria");
  await expect(opcoes.getByRole("option").first()).toContainText("17.16.01");
  await servico.fill("17.19");
  await expect(opcoes.getByRole("option", { name: /17\.19\.01 · Contabilidade/ })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(servico).toHaveValue(/^17\.19/);

  const descricao = page.getByLabel("Descrição do serviço");
  await descricao.fill("x".repeat(1001));
  await expect(page.getByText("1.001 / 1.000")).toHaveClass(/text-crimson/);
});

test("cliente sem dados fiscais: a nota nova avisa o que falta e o 'Novo tomador' cadastra e já escolhe o tomador", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await page.goto("/notas-fiscais?novo=1");
  await escolherCliente(page, cliente);

  const aviso = page.getByRole("status").filter({ hasText: "Este cliente ainda não está pronto para emitir" });
  await expect(aviso).toContainText("Informe o município e o regime tributário deste cliente.");
  await expect(aviso).toContainText("Você pode salvar a nota como rascunho e emitir depois.");
  await expect(aviso.getByRole("link", { name: `Abrir os dados fiscais de ${cliente.nome}` })).toHaveAttribute("href", `/notas-fiscais/configuracao?cliente=${cliente.id}`);

  // Sem tomadores na lista: o combobox diz isso e o botão ao lado resolve.
  await page.getByRole("combobox", { name: "Tomador" }).focus();
  await expect(page.getByText("Este cliente ainda não tem tomadores. Use “Novo tomador”.")).toBeVisible();
  await page.getByRole("button", { name: "Novo tomador" }).click();
  const dialogo = page.getByRole("dialog", { name: "Novo tomador" });
  await dialogo.getByRole("button", { name: "Cadastrar tomador" }).click();
  await expect(dialogo.getByText("Informe um CPF ou CNPJ válido")).toBeVisible();
  await expect(dialogo.getByLabel("CPF ou CNPJ")).toBeFocused();
  await dialogo.getByLabel("CPF ou CNPJ").fill("39053344705");
  await dialogo.getByLabel("Nome ou razão social").fill("João Pereira");
  await dialogo.getByRole("button", { name: "Cadastrar tomador" }).click();
  await expect(page.getByText("Tomador cadastrado")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Tomador" })).toHaveValue("João Pereira");
  await expect(page.getByText("390.533.447-05").first()).toBeVisible();

  // Com o cliente pendente, a revisão mostra a pendência e não deixa emitir.
  await page.getByLabel("Valor do serviço (R$)").fill("300");
  await page.getByLabel("Descrição do serviço").fill("Abertura de empresa");
  await page.getByRole("button", { name: "Revisar e emitir" }).click();
  const revisao = page.getByRole("dialog", { name: "Emitir a nota fiscal?" });
  await expect(revisao.getByRole("alert")).toContainText("Este cliente ainda não está pronto para emitir");
  await expect(revisao.getByRole("alert")).toContainText("Informe o município e o regime tributário deste cliente.");
  await expect(revisao.getByRole("button", { name: "Emitir nota" })).toBeDisabled();
  await expect(revisao.getByRole("button", { name: "Voltar e revisar" })).toBeEnabled();
});

test("trocar de cliente limpa o tomador, que é da lista do cliente anterior", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const primeiro = await api.criarCliente();
  const segundo = await api.criarCliente();
  await salvarDadosFiscais(page, primeiro);
  await cadastrarTomadorNaConfiguracao(page);

  await page.goto("/notas-fiscais?novo=1");
  await escolherCliente(page, primeiro);
  await escolherTomador(page);
  await expect(page.getByRole("combobox", { name: "Tomador" })).toHaveValue(TOMADOR_PADRAO.nome);

  await escolherCliente(page, segundo);
  await expect(page.getByRole("combobox", { name: "Tomador" })).toHaveValue("");
  await page.getByRole("combobox", { name: "Tomador" }).fill("Loja");
  await expect(page.getByText("Nenhum tomador encontrado.")).toBeVisible();
});

test("salva como rascunho, altera (o botão só liga quando algo muda) e exclui com confirmação", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await prepararCliente(page, cliente);

  await page.goto("/notas-fiscais?novo=1");
  await escolherCliente(page, cliente);
  await escolherTomador(page);
  await page.getByLabel("Valor do serviço (R$)").fill("750,50");
  await page.getByLabel("Descrição do serviço").fill("Abertura de empresa");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();

  await expect(page.getByText("Rascunho salvo")).toBeVisible();
  await expect(page).toHaveURL(/\/notas-fiscais\?id=\d+/);
  await expect(detalhe(page).getByText("Rascunho", { exact: true }).first()).toBeVisible();
  await expect(detalhe(page).getByText("R$ 750,50").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Revisar e emitir" })).toBeVisible();

  const salvar = page.getByRole("button", { name: "Salvar alterações" });
  await expect(salvar).toBeDisabled();
  await page.getByLabel("Valor do serviço (R$)").fill("900");
  await expect(salvar).toBeEnabled();
  await salvar.click();
  await expect(page.getByText("Alterações salvas")).toBeVisible();
  await expect(detalhe(page).getByText("R$ 900,00").first()).toBeVisible();
  await expect(page.getByLabel("Valor do serviço (R$)")).toHaveValue("900,00");
  await expect(salvar).toBeDisabled();
  await expect(detalhe(page).getByRole("listitem").filter({ hasText: "Dados alterados" })).toHaveCount(1);

  await detalhe(page).getByRole("button", { name: "Mais ações da nota" }).click();
  await page.getByRole("menuitem", { name: "Excluir rascunho" }).click();
  await page.getByRole("dialog", { name: "Excluir o rascunho?" }).getByRole("button", { name: "Excluir rascunho" }).click();
  await expect(page.getByText("Rascunho excluído")).toBeVisible();
  await expect(page).not.toHaveURL(/id=/);
  await expect(lista(page).getByRole("link")).toHaveCount(8);
});

test("nota rejeitada: mostra o motivo e o que fazer, aponta o campo, e a correção reemite na mesma nota", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await prepararCliente(page, cliente);
  const id = await emitirNota(page, cliente, { servico: "14.01.01" });

  await expect(detalhe(page).getByText("Rejeitada", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("O sistema nacional rejeitou a nota. Veja o motivo abaixo.")).toBeVisible();
  const motivo = detalhe(page).getByRole("region", { name: "Motivo da rejeição" });
  await expect(motivo).toContainText("E0312");
  await expect(motivo).toContainText("não está administrado pelo município"); // o texto oficial
  await expect(motivo).toContainText("Escolha um serviço que ela aceite"); // e o que fazer
  await expect(detalhe(page).getByText("não gerou nota fiscal")).toBeVisible();
  await expect(detalhe(page).getByText("Baixar PDF")).toHaveCount(0);
  // O campo apontado já aparece marcado, com o que fazer.
  const servico = page.getByRole("combobox", { name: "Serviço prestado" });
  await expect(servico).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(/^E0312: A prefeitura não administra esse serviço/)).toBeVisible();

  await motivo.getByRole("button", { name: "Ir para “Serviço prestado”" }).click();
  await expect(servico).toBeFocused();

  await escolherServico(page, "17.19.01");
  await expect(servico).not.toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Revisar e reemitir" }).click();
  const revisao = page.getByRole("dialog", { name: "Emitir a nota de novo?" });
  await revisao.getByRole("button", { name: "Emitir nota" }).click();

  await expect(detalhe(page).getByText("Autorizada", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(new RegExp(`id=${id}$`)); // a mesma nota, outra tentativa
  await expect(detalhe(page).getByRole("region", { name: "Motivo da rejeição" })).toHaveCount(0);
  const historico = detalhe(page).getByRole("list", { name: "Linha do tempo da nota" }).getByRole("listitem");
  await expect(historico).toHaveText([
    /Rascunho criado/,
    /Enviada para autorização/,
    /Rejeitada pelo sistema nacional/,
    /Dados alterados/,
    /Enviada para autorização/,
    /Autorizada pelo sistema nacional/,
  ]);
});

test("a nota rejeitada de exemplo avisa que o cliente não está mais no cadastro, e pode ser descartada", async ({ page }) => {
  await page.goto("/notas-fiscais?id=7");
  await expect(page.getByText(/O cliente desta nota \(Thiago Salgado ME\) não está mais no cadastro/)).toBeVisible();
  await expect(detalhe(page).getByRole("region", { name: "Motivo da rejeição" })).toContainText("E0312");

  await detalhe(page).getByRole("button", { name: "Mais ações da nota" }).click();
  await page.getByRole("menuitem", { name: "Excluir nota rejeitada" }).click();
  const confirmacao = page.getByRole("dialog", { name: "Excluir a nota rejeitada?" });
  await expect(confirmacao).toContainText("nada precisa ser cancelado");
  await confirmacao.getByRole("button", { name: "Excluir nota" }).click();
  await expect(page.getByText("Nota excluída")).toBeVisible();
  await expect(lista(page).getByRole("link")).toHaveCount(7);
});

test("cancela uma nota autorizada: cobra motivo e justificativa e deixa o cancelamento registrado", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await prepararCliente(page, cliente);
  await emitirNota(page, cliente);
  await expect(detalhe(page).getByText("Autorizada", { exact: true })).toBeVisible({ timeout: 10_000 });

  await detalhe(page).getByRole("button", { name: "Mais ações da nota" }).click();
  await page.getByRole("menuitem", { name: "Cancelar nota" }).click();
  const dialogo = page.getByRole("dialog", { name: "Cancelar a nota fiscal?" });
  await expect(dialogo).toContainText("Isso não pode ser desfeito");
  await expect(dialogo).toContainText(cliente.nome);

  await dialogo.getByRole("button", { name: "Cancelar nota" }).click();
  await expect(dialogo.getByText("Escolha o motivo do cancelamento")).toBeVisible();
  await expect(dialogo.getByText(/pelo menos 15 caracteres \(faltam 15\)/)).toBeVisible();
  await expect(dialogo.getByLabel("Motivo do cancelamento")).toBeFocused();

  await dialogo.getByLabel("Motivo do cancelamento").selectOption({ label: "Erro na emissão" });
  await dialogo.getByLabel("Justificativa").fill("curto");
  await dialogo.getByRole("button", { name: "Cancelar nota" }).click();
  await expect(dialogo.getByText(/faltam 10/)).toBeVisible();

  await dialogo.getByLabel("Justificativa").fill("Valor digitado errado na emissão");
  await dialogo.getByRole("button", { name: "Cancelar nota" }).click();
  await expect(page.getByText("Nota cancelada", { exact: true })).toBeVisible();
  await expect(dialogo).toBeHidden();

  await expect(detalhe(page).getByText("Cancelada", { exact: true }).first()).toBeVisible();
  const secao = detalhe(page).getByRole("group").filter({ hasText: "Cancelamento" });
  await expect(secao).toContainText("Erro na emissão");
  await expect(secao).toContainText("Valor digitado errado na emissão");
  await expect(detalhe(page).getByRole("button", { name: "Baixar PDF" })).toBeVisible(); // o PDF e o XML continuam
  await detalhe(page).getByRole("button", { name: "Mais ações da nota" }).click();
  await expect(page.getByRole("menuitem", { name: "Cancelar nota" })).toHaveCount(0);
});

test("nota autorizada há mais de 30 dias: o cancelamento é recusado com o código E0822 e a orientação", async ({ page }) => {
  await page.goto("/notas-fiscais?id=1");
  await detalhe(page).getByRole("button", { name: "Mais ações da nota" }).click();
  await page.getByRole("menuitem", { name: "Cancelar nota" }).click();
  const dialogo = page.getByRole("dialog", { name: "Cancelar a nota fiscal?" });
  await dialogo.getByLabel("Motivo do cancelamento").selectOption("1");
  await dialogo.getByLabel("Justificativa").fill("Serviço lançado para o cliente errado");
  await dialogo.getByRole("button", { name: "Cancelar nota" }).click();

  const recusa = dialogo.getByRole("alert");
  await expect(recusa).toContainText("O cancelamento foi recusado");
  await expect(recusa).toContainText("E0822: O prazo para o cancelamento da NFS-e expirou");
  await expect(recusa).toContainText("pedir análise fiscal à prefeitura");
  await expect(dialogo).toBeVisible();
});

test("a nota 'Emitir nova com estes dados' copia serviço, descrição e valor, e começa na data de hoje", async ({ page }) => {
  await page.goto("/notas-fiscais?id=4");
  await detalhe(page).getByRole("button", { name: "Mais ações da nota" }).click();
  await page.getByRole("menuitem", { name: "Emitir nota nova com estes dados" }).click();

  await expect(page).toHaveURL(/novo=1&copiar=4/);
  await expect(page.getByText(/Dados copiados da nota nº 44 de Marina Ferraz Consultoria para Loja Aurora Comércio Ltda/)).toBeVisible();
  await expect(page.getByLabel("Valor do serviço (R$)")).toHaveValue("3200,00");
  await expect(page.getByLabel("Descrição do serviço")).toHaveValue(/^Consultoria referente a \d{2}\/\d{4}$/); // a da nota copiada
  await expect(page.getByLabel("Data do serviço (competência)")).not.toHaveValue("");
});

test.describe("canal municipal de Salvador (sem certificado)", () => {
  test("o aviso acompanha o cliente na configuração, no formulário, na revisão e na nota, e a senha não volta à tela", async ({ page, request }) => {
    const api = await sessaoApi(request);
    const cliente = await api.criarCliente();
    await prepararCliente(page, cliente, { canal: "MUNICIPAL_SALVADOR" });

    // Configuração: o aviso fica junto do canal e do acesso; o usuário e as atividades aparecem, a senha não.
    const painel = painelDoCliente(page);
    await expect(painel.getByRole("note").filter({ hasText: "Esta nota sai pelo portal da Prefeitura de Salvador" })).toHaveCount(2); // junto do canal e do acesso
    await expect(painel.getByText("usuario.portal", { exact: true })).toBeVisible();
    await expect(painel.getByLabel("Senha no portal")).toHaveCount(0);
    await expect(page.getByText("senha-do-portal")).toHaveCount(0);
    const acesso = secaoDoPainel(page, "Acesso ao portal de Salvador");
    await expect(acesso).toBeVisible();
    await expect(acesso).toContainText("Atividades do cliente no portal");
    await expect(acesso).toContainText("17.19.01");
    await expect(painel.getByRole("listitem").filter({ hasText: "Acesso ao portal de Salvador" })).toContainText("Atenção");

    // Formulário: o serviço é uma atividade do cliente, a data é a do dia e o aviso aparece.
    await preencherNota(page, cliente);
    await expect(page.getByRole("status").filter({ hasText: "Emissão sem certificado." })).toContainText("captcha");
    await expect(page.getByLabel("Data do serviço (competência)")).toBeDisabled();
    await expect(page.getByText("No portal de Salvador a data da nota é a do dia da emissão.")).toBeVisible();
    const servico = page.getByRole("combobox", { name: "Serviço prestado" });
    await servico.fill("0");
    const atividades = page.getByRole("listbox", { name: "Atividades do cliente no portal de Salvador" });
    await expect(atividades.getByRole("option")).toHaveCount(3);
    await atividades.getByRole("option", { name: /^17\.19\.01/ }).click();

    // Revisão e nota.
    await page.getByRole("button", { name: "Revisar e emitir" }).click();
    const revisao = page.getByRole("dialog", { name: "Emitir a nota fiscal?" });
    await expect(revisao.getByRole("note").filter({ hasText: "Emissão sem certificado." })).toBeVisible();
    await expect(revisao).toContainText("Municipal (Salvador)");
    await revisao.getByRole("button", { name: "Emitir nota" }).click();

    // Nota: a etiqueta e o aviso continuam; o canal municipal demora o triplo, mas termina.
    await expect(revisao).toBeHidden();
    await expect(detalhe(page).getByText("Municipal · sem certificado", { exact: true })).toBeVisible(); // a etiqueta ao lado do título
    await expect(detalhe(page).getByText("Emissão sem certificado.")).toBeVisible(); // e o aviso, que continua na nota
    await expect(detalhe(page).getByText("Autorizada", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(lista(page).getByRole("link").first()).toContainText("municipal");
  });

  test("o portal pode pedir um captcha que não foi vencido: a nota é rejeitada com PORTAL01 e uma nova tentativa passa", async ({ page, request }) => {
    const api = await sessaoApi(request);
    const cliente = await api.criarCliente();
    await prepararCliente(page, cliente, { canal: "MUNICIPAL_SALVADOR" });

    await preencherNota(page, cliente);
    await page.getByLabel("Descrição do serviço").fill("Honorários (simula captcha)");
    await page.getByRole("button", { name: "Revisar e emitir" }).click();
    await page.getByRole("dialog", { name: "Emitir a nota fiscal?" }).getByRole("button", { name: "Emitir nota" }).click();

    const motivo = detalhe(page).getByRole("region", { name: "Motivo da rejeição" });
    await expect(motivo).toContainText("PORTAL01", { timeout: 15_000 });
    await expect(motivo).toContainText("captcha");

    await page.getByLabel("Descrição do serviço").fill("Honorários contábeis");
    await page.getByRole("button", { name: "Revisar e reemitir" }).click();
    await page.getByRole("dialog", { name: "Emitir a nota de novo?" }).getByRole("button", { name: "Emitir nota" }).click();
    await expect(detalhe(page).getByText("Autorizada", { exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test("movimento no portal: lê o que o cliente emitiu e a guia do mês, só leitura, e a consulta repetida atualiza o mesmo mês", async ({ page, request }) => {
    const api = await sessaoApi(request);
    const cliente = await api.criarCliente();
    await prepararCliente(page, cliente, { canal: "MUNICIPAL_SALVADOR" });

    const secao = secaoDoPainel(page, "Movimento no portal de Salvador");
    await secao.locator("summary").click(); // vem recolhida: é consulta ocasional
    await expect(secao).toContainText("Só leitura: nada é emitido.");
    await expect(secao).toContainText("ainda não foi consultado no portal");

    // O mês passado fecha e já tem guia emitida no portal; o mês corrente ainda não.
    await secao.getByRole("button", { name: "Consultar o portal" }).click();
    const resultado = secao.getByRole("region", { name: /^Movimento de / });
    await expect(resultado).toBeVisible();
    await expect(resultado).toContainText("Notas emitidas pelo cliente");
    const guias = resultado.getByRole("table");
    await expect(guias.getByRole("row")).toHaveCount(2); // cabeçalho + 1 guia
    await expect(guias).toContainText("Emitida · nº");
    await expect(secao.getByRole("button", { name: "Consultar de novo" })).toBeVisible();

    // Trocar para o mês corrente: ainda não consultado; consultado, a guia está a emitir e o sistema deixa claro que não a emite.
    const mesCorrente = secao.getByLabel("Mês a consultar").locator("option").first();
    await secao.getByLabel("Mês a consultar").selectOption(await mesCorrente.getAttribute("value"));
    await expect(secao).toContainText("ainda não foi consultado no portal");
    await secao.getByRole("button", { name: "Consultar o portal" }).click();
    await expect(resultado.getByRole("table")).toContainText("A emitir no portal — o sistema não emite guias");

    // Voltar ao mês passado: continua guardado.
    await secao.getByLabel("Mês a consultar").selectOption({ index: 1 });
    await expect(resultado.getByRole("table")).toContainText("Emitida · nº");
  });

  test("a seção do movimento só existe para quem tem o acesso ao portal guardado", async ({ page, request }) => {
    const api = await sessaoApi(request);
    const cliente = await api.criarCliente();
    await salvarDadosFiscais(page, cliente, { canal: "MUNICIPAL_SALVADOR" });
    await expect(secaoDoPainel(page, "Movimento no portal de Salvador")).toHaveCount(0);
    await salvarAcessoAoPortal(page);
    await expect(page.getByText("Acesso ao portal salvo")).toBeVisible();
    await expect(secaoDoPainel(page, "Movimento no portal de Salvador")).toHaveCount(1);
  });

  test("cliente de Salvador com os dois canais: o nacional não serve a Salvador, e cada nota escolhe por onde sai", async ({ page, request }) => {
    const api = await sessaoApi(request);
    const cliente = await api.criarCliente();
    await prepararCliente(page, cliente, { canal: "MUNICIPAL_SALVADOR" });
    await enviarCertificado(page);
    await expect(page.getByText("Certificado enviado")).toBeVisible();

    const painel = painelDoCliente(page);
    const nacional = painel.getByRole("group", { name: "Canal Nacional" });
    const municipal = painel.getByRole("group", { name: "Canal Municipal (Salvador)" });
    await expect(nacional).toContainText("Falta resolver 1 item antes de emitir pelo canal nacional.");
    await expect(nacional).toContainText("Emissor Nacional"); // Salvador emite no sistema da prefeitura
    await expect(municipal).toContainText("Pronto para emitir pelo canal municipal (salvador).");
    await expect(painel.getByRole("button", { name: "Testar conexão (Municipal (Salvador))" })).toBeVisible();

    // O teste de cada canal é separado.
    await painel.getByRole("button", { name: "Testar conexão (Municipal (Salvador))" }).click();
    await expect(painel.getByRole("region", { name: "Resultado do teste de conexão (Municipal (Salvador))" })).toContainText("A conexão está funcionando.");
    await expect(painel.getByRole("region", { name: "Resultado do teste de conexão (Nacional)" })).toHaveCount(0);

    // Na nota: o municipal vem escolhido (é o padrão do cliente); trocar para o nacional mostra o que falta e volta à lista nacional.
    await preencherNota(page, cliente);
    const emitirPor = page.getByRole("group", { name: "Emitir por" });
    await expect(emitirPor.getByRole("radio", { name: /Municipal de Salvador/ })).toBeChecked();
    await emitirPor.getByRole("radio", { name: /Nacional \(certificado\)/ }).check();
    await expect(page.getByRole("status").filter({ hasText: "Este cliente ainda não está pronto para emitir" })).toContainText("Emissor Nacional");
    await expect(page.getByLabel("Data do serviço (competência)")).toBeEnabled();
    await page.getByRole("combobox", { name: "Serviço prestado" }).fill("070201");
    await expect(page.getByRole("listbox", { name: "Serviços da lista nacional" })).toBeVisible();

    await emitirPor.getByRole("radio", { name: /Municipal de Salvador/ }).check();
    await expect(page.getByLabel("Data do serviço (competência)")).toBeDisabled();
    await expect(page.getByRole("status").filter({ hasText: "Emissão sem certificado." })).toBeVisible();
  });

  test("nos dados fiscais o canal municipal só se habilita para Salvador, e sair de Salvador volta ao nacional", async ({ page, request }) => {
    const api = await sessaoApi(request);
    const cliente = await api.criarCliente();
    await salvarDadosFiscais(page, cliente);
    const painel = painelDoCliente(page);
    const municipal = painel.getByRole("radio", { name: /Municipal de Salvador/ });
    await expect(municipal).toBeDisabled();
    await expect(painel.getByText("Disponível quando o município do cliente for Salvador.")).toBeVisible();
    await expect(secaoDoPainel(page, "Acesso ao portal de Salvador")).toHaveCount(0);

    await escolherMunicipio(page, "salvador", /Salvador\/BA/);
    await expect(municipal).toBeEnabled();
    await municipal.check();
    await expect(painel.getByRole("note").filter({ hasText: "Esta nota sai pelo portal da Prefeitura de Salvador" })).toHaveCount(1); // o aviso já aparece ao escolher

    await escolherMunicipio(page, "curitiba", /Curitiba\/PR/);
    await expect(painel.getByRole("radio", { name: /Nacional, com certificado digital/ })).toBeChecked();
    await expect(municipal).toBeDisabled();
  });
});

test("configuração fiscal: o ambiente vale para todos, produção pede confirmação e as notas de exemplo passam a ser 'de teste'", async ({ page }) => {
  await page.goto("/notas-fiscais/configuracao");
  await expect(page.getByRole("heading", { name: "Configuração fiscal", level: 1 })).toBeVisible();
  const ambiente = page.getByRole("region", { name: "Ambiente de emissão" });
  await expect(ambiente.getByRole("radio", { name: /Homologação/ })).toBeChecked();

  await ambiente.getByRole("radio", { name: /Produção/ }).click();
  const confirmacao = page.getByRole("dialog", { name: "Passar para produção?" });
  await expect(confirmacao).toContainText("tem validade fiscal");
  await confirmacao.getByRole("button", { name: "Continuar em homologação" }).click();
  await expect(ambiente.getByRole("radio", { name: /Homologação/ })).toBeChecked();

  await ambiente.getByRole("radio", { name: /Produção/ }).click();
  await confirmacao.getByRole("button", { name: "Passar para produção" }).click();
  await expect(page.getByText("Ambiente: produção")).toBeVisible();
  await expect(ambiente.getByRole("radio", { name: /Produção/ })).toBeChecked();

  await page.goto("/notas-fiscais");
  await expect(page.getByText("Ambiente de homologação:")).toHaveCount(0);
  await expect(lista(page).getByText(" · teste").first()).toBeVisible(); // as de exemplo agora são "de teste" no meio das de produção
});

test("configuração por cliente: lista os clientes com a situação, guia até ficar pronto e confere a conexão por etapas", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await page.goto("/notas-fiscais/configuracao");
  await expect(painelDoCliente(page).getByText("Selecione um cliente")).toBeVisible();

  await page.getByRole("searchbox", { name: /Buscar cliente/ }).fill(cliente.nome);
  await expect(page).toHaveURL(/busca=/);
  const item = page.getByRole("region", { name: "Clientes" }).getByRole("link", { name: new RegExp(cliente.nome) });
  await expect(item).toContainText("Sem dados fiscais");
  await item.click();
  await expect(page).toHaveURL(new RegExp(`cliente=${cliente.id}`));

  const painel = painelDoCliente(page);
  await expect(painel.getByRole("heading", { name: cliente.nome, level: 2 })).toBeVisible();
  await expect(painel.getByText("Falta resolver 3 itens antes de emitir para este cliente.")).toBeVisible();
  await expect(painel.getByText("Salve primeiro os dados fiscais acima.")).toBeVisible(); // a credencial depende do canal
  await expect(painel.getByRole("button", { name: "Testar conexão deste cliente" })).toHaveCount(0);
  await expect(painel.getByRole("link", { name: "Emitir nota" })).toHaveCount(0); // não está pronto

  // Dados fiscais: erro junto do campo, depois salvar.
  await painel.getByRole("button", { name: "Salvar dados fiscais" }).click();
  await expect(painel.getByText("Escolha o município na lista")).toBeVisible();
  await expect(painel.getByText("Escolha o regime tributário")).toBeVisible();
  await expect(painel.getByRole("combobox", { name: "Município do cliente" })).toBeFocused();

  await painel.getByRole("combobox", { name: "Município do cliente" }).fill("curitiba");
  await page.getByRole("listbox", { name: "Municípios encontrados" }).getByRole("option", { name: /Curitiba\/PR/ }).click();
  await expect(painel.getByRole("status").filter({ hasText: "planilha de adesões" })).toBeVisible();
  await painel.getByLabel("Regime tributário").selectOption("ME_EPP");
  await expect(painel.getByRole("radio", { name: /Nacional, com certificado digital/ })).toBeChecked(); // o caminho padrão e confiável
  await painel.getByRole("button", { name: "Salvar dados fiscais" }).click();
  await expect(page.getByText("Dados fiscais salvos")).toBeVisible();
  await expect(painel.getByText("Falta resolver 1 item antes de emitir para este cliente.")).toBeVisible();
  await expect(painel.getByRole("button", { name: "Salvar dados fiscais" })).toBeDisabled(); // nada mudou desde que salvou
  await expect(item).toContainText("Pendente"); // a lista ao lado acompanha

  await enviarCertificado(page);
  await expect(page.getByText("Certificado enviado")).toBeVisible();
  await expect(painel.getByText("Este cliente está pronto para emitir.")).toBeVisible();
  await expect(item).toContainText("Pronto");
  await expect(painel.getByRole("link", { name: "Emitir nota" })).toHaveAttribute("href", `/notas-fiscais?novo=1&clienteId=${cliente.id}`);

  const itens = painel.getByRole("listitem");
  await expect(itens.filter({ hasText: "Teste de conexão" })).toContainText("Atenção");
  await painel.getByRole("button", { name: "Testar conexão deste cliente" }).click();
  const resultado = painel.getByRole("region", { name: "Resultado do teste de conexão" });
  await expect(resultado).toContainText("A conexão está funcionando.");
  await expect(resultado.getByRole("listitem")).toHaveCount(4);
  await expect(itens.filter({ hasText: "Teste de conexão" })).toContainText("Pronto");

  // Qualquer mudança nos dados apaga o resultado do teste e pede um novo.
  await painel.getByLabel("Inscrição municipal (opcional)").fill("12345");
  await painel.getByRole("button", { name: "Salvar dados fiscais" }).click();
  await expect(page.getByText("Dados fiscais salvos")).toBeVisible();
  await expect(resultado).toHaveCount(0);
  await expect(itens.filter({ hasText: "Teste de conexão" })).toContainText("Atenção");
});

test("município que não libera o Emissor Nacional bloqueia a emissão do cliente, avisando em todo lugar e dizendo o que fazer", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await salvarDadosFiscais(page, cliente, { municipio: "brasilia", rotuloDoMunicipio: /Brasília\/DF/ });
  const painel = painelDoCliente(page);
  await expect(painel.getByRole("status").filter({ hasText: "Emissão pelo sistema da prefeitura" })).toContainText("a prefeitura precisa liberar o Emissor Nacional");
  await enviarCertificado(page);
  await expect(page.getByText("Certificado enviado")).toBeVisible();
  await expect(painel.getByText("Falta resolver 1 item antes de emitir para este cliente.")).toBeVisible();

  // O teste de conexão aponta a etapa que falhou e não testa as seguintes.
  await painel.getByRole("button", { name: "Testar conexão deste cliente" }).click();
  const resultado = painel.getByRole("region", { name: "Resultado do teste de conexão" });
  await expect(resultado).toContainText("O teste não passou.");
  await expect(resultado).toContainText("Não testado: corrija a etapa anterior.");

  // Na nota, o aviso do cliente aparece na hora, e a revisão não deixa emitir.
  await cadastrarTomadorNaConfiguracao(page);
  await preencherNota(page, cliente);
  await expect(page.getByRole("status").filter({ hasText: "Este cliente ainda não está pronto para emitir" })).toContainText("Emissor Nacional");
  await page.getByRole("button", { name: "Revisar e emitir" }).click();
  const revisao = page.getByRole("dialog", { name: "Emitir a nota fiscal?" });
  await expect(revisao.getByRole("alert")).toContainText("Emissor Nacional");
  await expect(revisao.getByRole("button", { name: "Emitir nota" })).toBeDisabled();
});

test("certificado do cliente: recusa arquivo e senha inválidos, apaga a senha depois de enviar, reconhece o vencido e o de outro titular, e a remoção bloqueia a emissão", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await salvarDadosFiscais(page, cliente);
  const painel = painelDoCliente(page);
  const secao = secaoDoPainel(page, "Certificado digital A1");
  await expect(secao).toContainText("Nenhum certificado enviado para este cliente.");

  await enviarCertificado(page, "leia-me.txt", "123");
  await expect(painel.getByText("Use um arquivo .pfx ou .p12 (certificado A1).")).toBeVisible();
  await enviarCertificado(page, "certificado.pfx", "");
  await expect(painel.getByText("Informe a senha do certificado")).toBeVisible();
  await expect(painel.getByLabel("Senha do certificado")).toBeFocused();
  await enviarCertificado(page, "certificado.pfx", "errada");
  await expect(painel.getByText("A senha não confere.")).toBeVisible();
  await expect(painel.getByLabel("Senha do certificado")).toHaveValue(""); // a senha não fica na tela depois do envio

  await enviarCertificado(page, "meu vencido.pfx", "123");
  await expect(page.getByText("Certificado enviado")).toBeVisible();
  await expect(secao).toContainText("Com problema");
  await expect(painel.getByText("Falta resolver 1 item antes de emitir para este cliente.")).toBeVisible();
  await expect(painel.getByText(/O certificado venceu em/)).toBeVisible();

  await secao.getByRole("button", { name: "Substituir certificado" }).click();
  await enviarCertificado(page, "de outro cnpj.p12", "123");
  await expect(painel.getByText(/O certificado é de 99\.999\.999\/0001-91, não deste cliente/)).toBeVisible();

  await secao.getByRole("button", { name: "Remover certificado" }).click();
  const confirmacao = page.getByRole("dialog", { name: "Remover o certificado?" });
  await expect(confirmacao).toContainText(cliente.nome);
  await confirmacao.getByRole("button", { name: "Remover certificado" }).click();
  await expect(page.getByText("Certificado removido")).toBeVisible();
  await expect(secao).toContainText("Nenhum certificado enviado para este cliente.");
  await expect(painel.getByText("Envie o certificado digital A1 deste cliente").first()).toBeVisible();

  await enviarCertificado(page, "novo.pfx", "segredo");
  await expect(painel.getByText("Este cliente está pronto para emitir.")).toBeVisible();
  await expect(page.getByText("segredo")).toHaveCount(0);
});

test("tomadores do cliente: cadastra, recusa documento inválido e repetido, edita, busca e remove", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await salvarDadosFiscais(page, cliente);
  const painel = painelDoCliente(page);
  await expect(painel.getByText("Nenhum tomador cadastrado para este cliente ainda.")).toBeVisible();

  await painel.getByRole("button", { name: "Novo tomador" }).click();
  const dialogo = page.getByRole("dialog", { name: "Novo tomador" });
  await dialogo.getByLabel("CPF ou CNPJ").fill("111.444.777-00");
  await dialogo.getByRole("button", { name: "Cadastrar tomador" }).click();
  await expect(dialogo.getByText("Informe um CPF ou CNPJ válido")).toBeVisible();
  await expect(dialogo.getByText("Informe o nome ou a razão social")).toBeVisible();
  await expect(dialogo.getByLabel("CPF ou CNPJ")).toBeFocused();
  await dialogo.getByLabel("CPF ou CNPJ").fill("11444777000161");
  await dialogo.getByLabel("Nome ou razão social").fill("Loja Aurora Comércio Ltda");
  await dialogo.getByLabel("E-mail (opcional)").fill("sem-arroba");
  await dialogo.getByRole("button", { name: "Cadastrar tomador" }).click();
  await expect(dialogo.getByText("Informe um e-mail válido (ou deixe vazio)")).toBeVisible();
  await dialogo.getByLabel("E-mail (opcional)").fill("financeiro@aurora.example");
  await dialogo.getByRole("button", { name: "Cadastrar tomador" }).click();
  await expect(page.getByText("Tomador cadastrado")).toBeVisible();
  await expect(painel.getByText("Loja Aurora Comércio Ltda")).toBeVisible();
  await expect(painel.getByText(/11\.444\.777\/0001-61 · financeiro@aurora\.example/)).toBeVisible(); // o documento volta formatado

  // O mesmo documento não entra duas vezes na lista do mesmo cliente.
  await painel.getByRole("button", { name: "Novo tomador" }).click();
  await dialogo.getByLabel("CPF ou CNPJ").fill("11.444.777/0001-61");
  await dialogo.getByLabel("Nome ou razão social").fill("Outro nome");
  await dialogo.getByRole("button", { name: "Cadastrar tomador" }).click();
  await expect(dialogo.getByText("Já está na lista deste cliente.")).toBeVisible();
  await dialogo.getByRole("button", { name: "Cancelar" }).click();

  await cadastrarTomadorNaConfiguracao(page, { documento: "390.533.447-05", nome: "Ana Pereira" });
  const itens = painel.getByRole("list").filter({ hasText: "Ana Pereira" }).getByRole("listitem");
  await expect(itens).toHaveText([/Ana Pereira/, /Loja Aurora/]); // em ordem alfabética

  // Editar.
  await painel.getByRole("button", { name: "Ações para Ana Pereira" }).click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  const edicao = page.getByRole("dialog", { name: "Editar tomador" });
  await expect(edicao.getByLabel("CPF ou CNPJ")).toHaveValue("390.533.447-05");
  await edicao.getByLabel("Nome ou razão social").fill("Ana Pereira Souza");
  await edicao.getByRole("button", { name: "Salvar tomador" }).click();
  await expect(page.getByText("Tomador salvo")).toBeVisible();
  await expect(painel.getByText("Ana Pereira Souza")).toBeVisible();

  // Remover (a confirmação diz que as notas já emitidas não mudam).
  await painel.getByRole("button", { name: "Ações para Ana Pereira Souza" }).click();
  await page.getByRole("menuitem", { name: "Remover da lista" }).click();
  const remocao = page.getByRole("dialog", { name: "Remover o tomador da lista?" });
  await expect(remocao).toContainText("As notas que já foram emitidas para ele continuam como estão.");
  await remocao.getByRole("button", { name: "Remover tomador" }).click();
  await expect(page.getByText("Tomador removido da lista")).toBeVisible();
  await expect(painel.getByText("Ana Pereira Souza")).toHaveCount(0);
  await expect(painel.getByText("Loja Aurora Comércio Ltda")).toBeVisible();
});

test("os dados fiscais e os tomadores são de cada cliente: o que se configura para um não vale para outro", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const um = await api.criarCliente();
  const outro = await api.criarCliente();
  await prepararCliente(page, um);

  await page.goto(`/notas-fiscais/configuracao?cliente=${outro.id}`);
  const painel = painelDoCliente(page);
  await expect(painel.getByText("Falta resolver 3 itens antes de emitir para este cliente.")).toBeVisible();
  await expect(painel.getByText("Nenhum tomador cadastrado para este cliente ainda.")).toBeVisible();

  await page.goto(`/notas-fiscais/configuracao?cliente=${um.id}`);
  await expect(painel.getByText("Este cliente está pronto para emitir.")).toBeVisible();
  await expect(painel.getByText(TOMADOR_PADRAO.nome)).toBeVisible();
});

test("menu em acordeão: o grupo Fiscal abre e fecha, e abre sozinho quando a tela é dele", async ({ page }) => {
  await page.goto("/painel");
  const menu = page.getByRole("navigation", { name: "Principal" });
  const grupo = menu.getByRole("button", { name: "Fiscal" });

  await expect(grupo).toHaveAttribute("aria-expanded", "false");
  await expect(menu.getByRole("link", { name: "Notas fiscais" })).toBeHidden();
  await grupo.click();
  await expect(grupo).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("link", { name: "Notas fiscais" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Guias" })).toBeVisible();

  await menu.getByRole("link", { name: "Guias" }).click();
  await expect(page).toHaveURL(/\/guias/);
  await expect(menu.getByRole("link", { name: "Guias" })).toHaveAttribute("aria-current", "page");
  await expect(grupo).toHaveAttribute("aria-expanded", "true");

  // Recolher por conta própria vale até a pessoa chegar a uma tela do grupo por outro caminho (aqui, a palette).
  await grupo.click();
  await expect(grupo).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Buscar cliente, guia, ação ou tela…").fill("notas fiscais");
  await page.getByRole("option", { name: "Notas fiscais", exact: true }).click();
  await expect(page).toHaveURL(/\/notas-fiscais$/);
  await expect(grupo).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("link", { name: "Notas fiscais" })).toHaveAttribute("aria-current", "page");
});

test("command palette: acha uma nota, e 'Emitir nota para…' leva à nota nova com o cliente já escolhido", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  const paleta = page.getByRole("dialog", { name: "Buscar clientes, ações e telas" });

  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Buscar cliente, guia, ação ou tela…").fill("oliveira");
  await paleta.getByRole("option", { name: /Oliveira & Andrade Ltda/ }).click();
  await expect(page).toHaveURL(/\/notas-fiscais\?id=5/);

  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Buscar cliente, guia, ação ou tela…").fill(cliente.nome);
  await paleta.getByRole("option", { name: `Emitir nota para ${cliente.nome}` }).click();
  await expect(page).toHaveURL(new RegExp(`novo=1&clienteId=${cliente.id}`));
  await expect(page.getByRole("combobox", { name: "Cliente (prestador)" })).toHaveValue(cliente.nome);

  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Buscar cliente, guia, ação ou tela…").fill("emitir nota fiscal");
  await expect(paleta.getByRole("option", { name: "Emitir nota fiscal" })).toBeVisible();
});

test("o detalhe do cliente lista as notas dele e leva aos dados fiscais e à emissão com o cliente escolhido", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await page.goto(`/clientes?id=${cliente.id}`);
  const secao = page.getByRole("group").filter({ hasText: "Notas fiscais" });
  await expect(secao.getByText("Nenhuma nota", { exact: true })).toBeVisible();

  await secao.getByRole("link", { name: "Dados fiscais" }).click();
  await expect(page).toHaveURL(new RegExp(`/notas-fiscais/configuracao\\?cliente=${cliente.id}`));
  await expect(painelDoCliente(page).getByRole("heading", { name: cliente.nome, level: 2 })).toBeVisible();

  await prepararCliente(page, cliente);
  await emitirNota(page, cliente, { valor: "2.500" });
  await expect(detalhe(page).getByText("Autorizada", { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.goto(`/clientes?id=${cliente.id}`);
  await expect(secao.getByText("1 nota", { exact: true })).toBeVisible();
  await expect(secao.getByRole("link", { name: /R\$ 2\.500,00/ })).toContainText("Autorizada");
  await secao.getByRole("link", { name: "Emitir nota" }).click();
  await expect(page).toHaveURL(new RegExp(`/notas-fiscais\\?novo=1&clienteId=${cliente.id}`));
  await expect(page.getByRole("combobox", { name: "Cliente (prestador)" })).toHaveValue(cliente.nome);

  await page.goto(`/clientes?id=${cliente.id}`);
  await secao.getByRole("link", { name: "Ver todas as notas" }).click();
  await expect(page).toHaveURL(new RegExp(`clienteId=${cliente.id}`));
  await expect(page.getByText(`Cliente: ${cliente.nome}`)).toBeVisible();
  await expect(lista(page).getByRole("link")).toHaveCount(1);
  await page.getByRole("button", { name: "Remover filtro de cliente" }).click();
  await expect(lista(page).getByRole("link")).toHaveCount(9);
});

test("'Restaurar dados de exemplo' desfaz o que foi feito na demonstração, inclusive os dados fiscais e os tomadores", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await prepararCliente(page, cliente);
  await emitirNota(page, cliente);
  await page.goto("/notas-fiscais");
  await expect(lista(page).getByRole("link")).toHaveCount(9);

  await page.getByRole("button", { name: "Restaurar dados de exemplo" }).click();
  await expect(page.getByText("Dados de exemplo restaurados")).toBeVisible();
  await expect(lista(page).getByRole("link")).toHaveCount(8);

  await page.goto(`/notas-fiscais/configuracao?cliente=${cliente.id}`);
  await expect(painelDoCliente(page).getByText("Falta resolver 3 itens antes de emitir para este cliente.")).toBeVisible();
  await expect(painelDoCliente(page).getByText("Nenhum tomador cadastrado para este cliente ainda.")).toBeVisible();
});
