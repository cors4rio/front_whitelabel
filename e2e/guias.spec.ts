import { expect, test } from "@playwright/test";

import { dataBR, dataRelativa, PDF_BYTES, PNG_BYTES, sessaoApi } from "./api";
import { entrar, unico } from "./helpers";

test.beforeEach(async ({ page }) => {
  await entrar(page, "/guias");
});

const lista = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Lista de guias" });
const detalhe = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Detalhe da guia" });

test("cadastra uma guia escolhendo o cliente por busca, com PDF, e abre o detalhe dela", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  const descricao = `DAS ${unico()}`;

  await page.getByRole("link", { name: "Nova guia" }).first().click();
  await expect(page).toHaveURL(/novo=1/);

  const combo = page.getByRole("combobox", { name: "Cliente", exact: true });
  await combo.fill(cliente.cpf); // busca pelo documento, não só pelo nome
  await page.getByRole("listbox", { name: "Clientes encontrados" }).getByRole("option", { name: new RegExp(cliente.nome) }).click();
  await expect(combo).toHaveValue(cliente.nome);

  await page.getByLabel("Descrição", { exact: true }).fill(descricao);
  await page.getByLabel("Valor (R$)").fill("1.245,90");
  await page.getByLabel("Vencimento").fill(dataRelativa(5));
  await page.getByLabel("PDF da guia (opcional)").setInputFiles({ name: "DAS setembro.pdf", mimeType: "application/pdf", buffer: PDF_BYTES });
  await expect(page.getByText("DAS setembro.pdf")).toBeVisible();
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect(page.getByText("Guia cadastrada")).toBeVisible();
  await expect(page).toHaveURL(/\/guias\?id=\d+/);
  await expect(page.getByRole("heading", { name: descricao, level: 2 })).toBeVisible();
  await expect(detalhe(page).getByText("R$ 1.245,90").first()).toBeVisible();
  await expect(detalhe(page).getByText("DAS setembro.pdf")).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir PDF da guia" })).toBeVisible();
});

test("o combobox de cliente funciona pelo teclado: Enter escolhe, Esc fecha, editar o texto desfaz a escolha", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await page.goto("/guias?novo=1");

  const combo = page.getByRole("combobox", { name: "Cliente", exact: true });
  const opcoes = page.getByRole("listbox", { name: "Clientes encontrados" });

  await combo.fill(cliente.nome);
  // A busca é no servidor e vem depois de uma pequena pausa na digitação: espera a lista se resumir ao cliente.
  await expect(opcoes.getByRole("option")).toHaveCount(1);
  await expect(opcoes.getByRole("option", { name: new RegExp(cliente.nome) })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(opcoes).toBeHidden();

  await page.keyboard.press("ArrowDown");
  await expect(opcoes).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(opcoes).toBeHidden();
  await expect(combo).toHaveValue(cliente.nome);

  // Editar o texto depois de escolher desfaz a escolha: o campo nunca mostra um nome diferente do valor real.
  await combo.pressSequentially("x");
  await page.getByLabel("Descrição", { exact: true }).fill("Qualquer");
  await page.getByLabel("Valor (R$)").fill("10");
  await page.getByLabel("Vencimento").fill(dataRelativa(3));
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("Escolha o cliente")).toBeVisible();
});

test("valida os campos, mostra o erro junto de cada um e leva o foco ao primeiro inválido", async ({ page }) => {
  await page.goto("/guias?novo=1");
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect(page.getByText("Escolha o cliente")).toBeVisible();
  await expect(page.getByText("Informe a descrição")).toBeVisible();
  await expect(page.getByText("Informe um valor válido, como 1.245,90")).toBeVisible();
  await expect(page.getByText("Informe a data de vencimento")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Cliente", exact: true })).toBeFocused();
});

test("destaca vencida e vencendo com cor E texto, e filtra por situação pela URL", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  const marca = `Urg${unico()}`;
  await api.criarGuia(cliente.id, `${marca} vencida`, 10, dataRelativa(-3));
  await api.criarGuia(cliente.id, `${marca} vencendo`, 20, dataRelativa(2));
  await api.criarGuia(cliente.id, `${marca} longe`, 30, dataRelativa(30));

  await page.goto(`/guias?busca=${marca}`);
  const linha = (nome: string) => lista(page).getByRole("link", { name: new RegExp(`${marca} ${nome}`) });

  // A urgência nunca depende só da cor: a data ganha um complemento em texto e a vencida ganha o rótulo "Vencida".
  await expect(linha("vencida")).toContainText("há 3 dias");
  await expect(linha("vencida")).toContainText("Vencida");
  await expect(linha("vencida").getByText(dataBR(dataRelativa(-3)))).toHaveClass(/text-crimson/);
  await expect(linha("vencendo")).toContainText("em 2 dias");
  await expect(linha("vencendo").getByText(dataBR(dataRelativa(2)))).toHaveClass(/text-amber-ink/);
  await expect(linha("longe")).not.toContainText("em 30 dias");
  await expect(linha("longe")).toContainText("Pendente");

  // Mais urgentes primeiro: vencida, vencendo, longe.
  await expect(lista(page).getByRole("link")).toHaveText([/vencida/, /vencendo/, /longe/]);

  await page.getByLabel("Filtrar por situação").selectOption("VENCIDA");
  await expect(page).toHaveURL(/situacao=VENCIDA/);
  await expect(lista(page).getByRole("link")).toHaveCount(1);
  await expect(linha("vencida")).toBeVisible();

  await page.getByLabel("Filtrar por situação").selectOption("VENCENDO");
  await expect(lista(page).getByRole("link")).toHaveCount(1);
  await expect(linha("vencendo")).toBeVisible();

  // O filtro vem da URL: um link direto abre a lista já filtrada.
  await page.goto(`/guias?busca=${marca}&situacao=TODAS`);
  await expect(lista(page).getByRole("link")).toHaveCount(3);
});

test("marca como paga com comprovante; data futura é recusada; reabrir desfaz o pagamento", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  const descricao = `Pgto ${unico()}`;
  const id = await api.criarGuia(cliente.id, descricao, 500, dataRelativa(-2));
  await page.goto(`/guias?id=${id}`);

  await expect(detalhe(page).getByText("Vencida", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Marcar como paga" }).click();
  const dialogo = page.getByRole("dialog", { name: "Marcar como paga" });
  await expect(dialogo.getByLabel("Data do pagamento")).toHaveValue(dataRelativa(0));

  // Data futura: o servidor recusa e o erro aparece junto do campo, sem fechar o diálogo.
  await dialogo.getByLabel("Data do pagamento").fill(dataRelativa(1));
  await dialogo.getByRole("button", { name: "Registrar pagamento" }).click();
  await expect(dialogo.getByText("A data de pagamento não pode ser futura.")).toBeVisible();

  await dialogo.getByLabel("Data do pagamento").fill(dataRelativa(-1));
  await dialogo.getByLabel("Comprovante (opcional)").setInputFiles({ name: "print do banco.png", mimeType: "image/png", buffer: PNG_BYTES });
  await expect(dialogo.getByText("print do banco.png")).toBeVisible();
  await dialogo.getByRole("button", { name: "Registrar pagamento" }).click();

  await expect(page.getByText("Pagamento registrado")).toBeVisible();
  await expect(detalhe(page).getByText("Paga", { exact: true })).toBeVisible();
  await expect(detalhe(page).getByText(`Paga em ${dataBR(dataRelativa(-1))}`)).toBeVisible();
  await expect(detalhe(page).getByText("print do banco.png")).toBeVisible();
  await expect(page.getByRole("button", { name: "Marcar como paga" })).toHaveCount(0);
  // Guia paga não se edita.
  await expect(page.getByLabel("Descrição", { exact: true })).toBeDisabled();

  await page.getByRole("button", { name: "Mais ações da guia" }).click();
  await page.getByRole("menuitem", { name: "Reabrir guia (desfazer pagamento)" }).click();
  const confirmacao = page.getByRole("dialog", { name: "Reabrir a guia?" });
  await expect(confirmacao).toContainText("a data do pagamento e o comprovante são apagados");
  await confirmacao.getByRole("button", { name: "Reabrir guia" }).click();

  await expect(page.getByText("Guia reaberta")).toBeVisible();
  await expect(detalhe(page).getByText("Vencida", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marcar como paga" })).toBeVisible();
  await expect(detalhe(page).getByText("print do banco.png")).toHaveCount(0);
});

test("PDF da guia: anexa, abre com login, baixa, substitui e remove", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  const id = await api.criarGuia(cliente.id, `Pdf ${unico()}`, 100, dataRelativa(10));

  // O navegador de teste não exibe PDF: troca window.open por um espião que guarda o endereço recebido.
  await page.addInitScript(() => {
    const w = window as unknown as { __abertos: string[] };
    w.__abertos = [];
    window.open = () =>
      ({ location: { set href(v: string) { w.__abertos.push(v); } }, close() {}, opener: null }) as unknown as Window;
  });
  await page.goto(`/guias?id=${id}`);

  await expect(detalhe(page).getByText("Nenhum PDF anexado a esta guia.")).toBeVisible();
  await page.getByLabel("PDF da guia: escolher arquivo").setInputFiles({ name: "primeiro.pdf", mimeType: "application/pdf", buffer: PDF_BYTES });
  await expect(page.getByText("PDF anexado")).toBeVisible();
  await expect(detalhe(page).getByText("primeiro.pdf")).toBeVisible();

  // Abrir: o arquivo é buscado COM o login (o token está em memória, não em cookie) e vira um endereço de blob.
  await page.getByRole("button", { name: "Abrir PDF da guia" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __abertos: string[] }).__abertos.length)).toBe(1);
  const lido = await page.evaluate(async () => {
    const url = (window as unknown as { __abertos: string[] }).__abertos[0];
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    return { url: url.slice(0, 5), inicio: String.fromCharCode(...bytes.slice(0, 5)), tamanho: bytes.length };
  });
  expect(lido).toEqual({ url: "blob:", inicio: "%PDF-", tamanho: PDF_BYTES.length });

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Baixar PDF da guia" }).click()]);
  expect(download.suggestedFilename()).toBe("primeiro.pdf");

  // Substituir pelo menu "⋯" do anexo.
  await page.getByRole("button", { name: "Mais ações: PDF da guia" }).click();
  const [seletor] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("menuitem", { name: "Substituir arquivo" }).click()]);
  await seletor.setFiles({ name: "segundo.pdf", mimeType: "application/pdf", buffer: PDF_BYTES });
  await expect(detalhe(page).getByText("segundo.pdf")).toBeVisible();
  await expect(detalhe(page).getByText("primeiro.pdf")).toHaveCount(0);

  // Remover pede confirmação.
  await page.getByRole("button", { name: "Mais ações: PDF da guia" }).click();
  await page.getByRole("menuitem", { name: "Remover arquivo" }).click();
  await page.getByRole("dialog", { name: "Remover arquivo?" }).getByRole("button", { name: "Remover arquivo" }).click();
  await expect(page.getByText("PDF removido")).toBeVisible();
  await expect(detalhe(page).getByText("Nenhum PDF anexado a esta guia.")).toBeVisible();
});

test("recusa, com explicação, um arquivo que não é PDF mesmo com nome .pdf", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const id = await api.criarGuia((await api.criarCliente()).id, `Falso ${unico()}`, 100, dataRelativa(10));
  await page.goto(`/guias?id=${id}`);

  await page.getByLabel("PDF da guia: escolher arquivo").setInputFiles({
    name: "fatura.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("isto é só texto"),
  });

  await expect(page.getByText("O arquivo precisa ser um PDF.")).toBeVisible();
  await expect(detalhe(page).getByText("Nenhum PDF anexado a esta guia.")).toBeVisible();
});

test("edita os dados (o botão só liga quando algo muda), cancela e reabre", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const descricao = `Edit ${unico()}`;
  const id = await api.criarGuia((await api.criarCliente()).id, descricao, 100, dataRelativa(10));
  await page.goto(`/guias?id=${id}`);

  const salvar = page.getByRole("button", { name: "Salvar alterações" });
  await expect(salvar).toBeDisabled();
  await page.getByLabel("Valor (R$)").fill("250,5");
  await expect(salvar).toBeEnabled();
  await salvar.click();
  await expect(page.getByText("Guia salva")).toBeVisible();
  await expect(detalhe(page).getByText("R$ 250,50").first()).toBeVisible();
  await expect(page.getByLabel("Valor (R$)")).toHaveValue("250,50");
  await expect(salvar).toBeDisabled();

  await page.getByRole("button", { name: "Mais ações da guia" }).click();
  await page.getByRole("menuitem", { name: "Cancelar guia" }).click();
  await expect(page.getByRole("status").getByText("Guia cancelada")).toBeVisible();
  await expect(detalhe(page).getByText("Cancelada", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Descrição", { exact: true })).toBeDisabled();

  await page.getByRole("button", { name: "Reabrir guia" }).click();
  await expect(page.getByText("Guia reaberta")).toBeVisible();
  await expect(page.getByLabel("Descrição", { exact: true })).toBeEnabled();
});

test("excluir a guia pede confirmação e volta para a lista", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const descricao = `Excluir ${unico()}`;
  const id = await api.criarGuia((await api.criarCliente()).id, descricao, 100, dataRelativa(10));
  await page.goto(`/guias?id=${id}&busca=${descricao}`);

  await page.getByRole("button", { name: "Mais ações da guia" }).click();
  await page.getByRole("menuitem", { name: "Excluir guia" }).click();
  await page.getByRole("dialog", { name: "Excluir guia?" }).getByRole("button", { name: "Excluir guia" }).click();

  await expect(page.getByText("Guia excluída")).toBeVisible();
  await expect(page).not.toHaveURL(/id=/);
  await expect(page.getByText("Nenhuma guia encontrada")).toBeVisible();
});

test("o detalhe do cliente lista as guias em aberto e bloqueia a exclusão enquanto houver alguma", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  const guiaId = await api.criarGuia(cliente.id, `Aberta ${unico()}`, 100, dataRelativa(-1));

  await page.goto(`/clientes?id=${cliente.id}`);
  const secao = page.getByRole("group").filter({ hasText: "Guias" });
  await expect(secao.getByText("1 em aberto")).toBeVisible();
  await expect(secao.getByText("há 1 dia").or(secao.getByText("ontem"))).toBeVisible();

  await page.getByRole("button", { name: "Excluir cliente" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir cliente" }).click();
  await expect(page.getByText("Este cliente tem 1 guia em aberto. Marque-a como paga ou cancele-a antes de excluir o cliente.")).toBeVisible();

  // Cancelando a guia, o cliente pode sair.
  await api.cancelarGuia(guiaId);
  await page.reload();
  await page.getByRole("button", { name: "Excluir cliente" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir cliente" }).click();
  await expect(page.getByText("Cliente excluído")).toBeVisible();
});

test("'Nova guia' a partir do cliente já vem com o cliente escolhido, e o filtro por cliente aparece como etiqueta", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await api.criarGuia(cliente.id, `Do cliente ${unico()}`, 100, dataRelativa(10));

  await page.goto(`/clientes?id=${cliente.id}`);
  await page.getByRole("link", { name: "Nova guia" }).click();
  await expect(page).toHaveURL(new RegExp(`novo=1&clienteId=${cliente.id}`));
  await expect(page.getByRole("combobox", { name: "Cliente", exact: true })).toHaveValue(cliente.nome);

  await page.goto(`/guias?clienteId=${cliente.id}&situacao=TODAS`);
  await expect(page.getByText(`Cliente: ${cliente.nome}`)).toBeVisible();
  await expect(lista(page).getByRole("link")).toHaveCount(1);
  await page.getByRole("button", { name: "Remover filtro de cliente" }).click();
  await expect(page).not.toHaveURL(/clienteId=/);
});

test("o Painel conta vencidas e vencendo e cada alerta leva à lista já filtrada", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await api.criarGuia(cliente.id, `PainelV ${unico()}`, 10, dataRelativa(-5));
  await api.criarGuia(cliente.id, `PainelA ${unico()}`, 10, dataRelativa(3));

  await page.goto("/painel");
  const alertaVencidas = page.getByRole("listitem").filter({ hasText: /guias? vencidas?/ });
  await expect(alertaVencidas).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /guias? vencem? nos próximos 7 dias/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /Guias pendentes por dia de vencimento/ })).toBeVisible();

  await alertaVencidas.getByRole("link", { name: "Ver quais" }).click();
  await expect(page).toHaveURL(/\/guias\?situacao=VENCIDA/);
  await expect(page.getByLabel("Filtrar por situação")).toHaveValue("VENCIDA");
});

test("command palette: acha uma guia em aberto e oferece 'Nova guia'", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const descricao = `Paleta${unico()}`;
  const id = await api.criarGuia((await api.criarCliente()).id, descricao, 100, dataRelativa(4));

  await page.goto("/painel");
  await expect(page.getByRole("heading", { name: "Painel", level: 1 })).toBeVisible();
  await page.keyboard.press("Control+k");
  const paleta = page.getByRole("dialog", { name: "Buscar clientes, ações e telas" });
  await page.getByPlaceholder("Buscar cliente, guia, ação ou tela…").fill(descricao);
  await expect(paleta.getByRole("option", { name: new RegExp(descricao) })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/guias\\?id=${id}`));

  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Buscar cliente, guia, ação ou tela…").fill("nova guia");
  const acao = paleta.getByRole("option", { name: "Nova guia" });
  await expect(acao).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/guias\?novo=1/);
});

test("guia vencida do DAS mostra quanto custa pagar (estimativa) e a data muda a conta; FGTS manda ver no portal", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  const vencimento = dataRelativa(-10);
  const id = await api.criarGuia(cliente.id, `DAS ${unico()}`, 1000, vencimento, "DAS");
  const fgts = await api.criarGuia(cliente.id, `FGTS ${unico()}`, 500, vencimento, "FGTS");

  await page.goto(`/guias?id=${id}`);
  const secao = detalhe(page).locator("details").filter({ has: page.locator("summary", { hasText: "Quanto custa pagar" }) });
  await expect(secao).toBeVisible();
  const estimativa = secao.getByRole("region", { name: "Estimativa do atraso" });
  await expect(estimativa).toContainText("10 dias de atraso");
  await expect(estimativa).toContainText("3,30%");
  await expect(estimativa).toContainText("R$ 33,00");
  // Juros: zero no mês do vencimento; 1% (R$ 10,00) se o vencimento foi no mês passado.
  const mesmoMes = dataRelativa(0).slice(0, 7) === vencimento.slice(0, 7);
  await expect(estimativa).toContainText(mesmoMes ? "R$ 1.033,00" : "R$ 1.043,00");
  await expect(secao).toContainText("Estimativa pela fórmula da Receita");

  // Pagar 5 dias depois: 15 dias de atraso, multa de 4,95% = R$ 49,50.
  await secao.getByLabel("Se pagar em").fill(dataRelativa(5));
  await expect(estimativa).toContainText("15 dias de atraso");
  await expect(estimativa).toContainText("R$ 49,50");

  // O tipo vem do cadastro e muda pelo formulário.
  await expect(detalhe(page).getByLabel("Tipo da guia")).toHaveValue("DAS");

  await page.goto(`/guias?id=${fgts}`);
  const secaoFgts = detalhe(page).locator("details").filter({ has: page.locator("summary", { hasText: "Quanto custa pagar" }) });
  await expect(secaoFgts).toContainText("FGTS Digital calcula os encargos");
  await expect(secaoFgts.getByRole("region", { name: "Estimativa do atraso" })).toHaveCount(0);
});

test("o tipo da guia é escolhido ao cadastrar, e uma guia em dia não mostra a estimativa", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();

  await page.goto("/guias?novo=1");
  await page.getByRole("combobox", { name: "Cliente", exact: true }).fill(cliente.cpf);
  await page.getByRole("listbox", { name: "Clientes encontrados" }).getByRole("option", { name: new RegExp(cliente.nome) }).click();
  await page.getByLabel("Descrição", { exact: true }).fill(`GPS ${unico()}`);
  await page.getByLabel("Tipo da guia").selectOption("GPS");
  await page.getByLabel("Valor (R$)").fill("250");
  await page.getByLabel("Vencimento").fill(dataRelativa(10));
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("Guia cadastrada")).toBeVisible();
  await expect(detalhe(page).getByLabel("Tipo da guia")).toHaveValue("GPS");
  await expect(detalhe(page).locator("summary", { hasText: "Quanto custa pagar" })).toHaveCount(0); // ainda não venceu

  // Trocar o tipo é uma alteração como outra qualquer.
  const salvar = detalhe(page).getByRole("button", { name: "Salvar alterações" });
  await expect(salvar).toBeDisabled();
  await detalhe(page).getByLabel("Tipo da guia").selectOption("DARF");
  await expect(salvar).toBeEnabled();
  await salvar.click();
  await expect(page.getByText("Guia salva")).toBeVisible();
});
