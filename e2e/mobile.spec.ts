import { expect, test, type Page } from "@playwright/test";

import { dataRelativa, sessaoApi } from "./api";
import { cpfFake, entrar, unico } from "./helpers";
import { escolherCliente, escolherTomador, painelDoCliente, prepararCliente } from "./notas";

/**
 * Elementos que passam da largura da tela (conteúdo estourando, botão cortado). Não compara com
 * window.innerWidth: na emulação de celular o viewport "encolhe" para caber o conteúdo e o teste passaria
 * mesmo com a tela quebrada. O limite é a largura real configurada para o teste.
 */
async function foraDaTela(page: Page, largura: number) {
  return page.evaluate(
    (limite) =>
      Array.from(document.querySelectorAll("main *, header *"))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.right > limite + 1 || r.left < -1);
        })
        .slice(0, 5)
        .map((el) => `<${el.tagName.toLowerCase()}> "${(el.textContent ?? "").trim().slice(0, 30)}" right=${Math.round(el.getBoundingClientRect().right)}`),
    largura,
  );
}

// Critério de aceite (docs/ui-ux.md, seção 5): nenhuma tela inacessível por causa do menu em 375px e 390px.
for (const viewport of [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
]) {
  test.describe(`celular ${viewport.width}px`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await entrar(page);
    });

    test("o menu abre como drawer sem cobrir a tela e fecha ao tocar fora, no item e com Esc", async ({ page }) => {
      const menu = page.getByRole("dialog", { name: "Menu principal" });
      const moldura = menu.locator("xpath=..");
      // Fechado: fora da tela e inert (não recebe foco nem toque, e o leitor de tela o ignora).
      const esperarFechado = async () => {
        await expect(moldura).toHaveAttribute("inert", "");
        await expect.poll(async () => (await menu.boundingBox())!.x + (await menu.boundingBox())!.width).toBeLessThanOrEqual(1);
      };
      await esperarFechado();
      await expect(page.getByRole("heading", { name: "Painel", level: 1 })).toBeVisible();

      await page.getByRole("button", { name: "Abrir menu" }).click();
      await expect(moldura).not.toHaveAttribute("inert", "");
      await expect.poll(async () => (await menu.boundingBox())!.x).toBeGreaterThanOrEqual(-1);
      const caixa = await menu.boundingBox();
      expect(caixa!.width).toBeLessThanOrEqual(320);
      expect(caixa!.width).toBeLessThan(viewport.width * 0.9); // sobra área do overlay para tocar e fechar

      // 1) toque fora (no overlay)
      await page.mouse.click(viewport.width - 8, viewport.height / 2);
      await esperarFechado();

      // 2) Esc
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await expect(moldura).not.toHaveAttribute("inert", "");
      await page.keyboard.press("Escape");
      await esperarFechado();

      // 3) escolher um item navega e fecha
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await expect(moldura).not.toHaveAttribute("inert", "");
      await menu.getByRole("link", { name: "Clientes" }).click();
      await expect(page).toHaveURL(/\/clientes/);
      await esperarFechado();
      await expect(page.getByRole("heading", { name: "Clientes", level: 1 })).toBeVisible();
    });

    test("nenhum elemento passa da largura da tela (sem rolagem lateral nem botão cortado)", async ({ page, request }) => {
      // Cria um cliente e guias para também medir os detalhes com dados (nomes compridos de propósito).
      await page.goto("/clientes?novo=1");
      await page.getByLabel("Nome ou razão social").fill(`E2E Largura ${unico()}`);
      await page.getByLabel("CPF ou CNPJ").fill(cpfFake());
      await page.getByRole("button", { name: "Cadastrar" }).click();
      await expect(page).toHaveURL(/\/clientes\?id=\d+/);
      const detalhe = page.url();

      const api = await sessaoApi(request);
      const cliente = await api.criarCliente(`E2E Largura Guia Com Um Nome Bem Comprido Ltda ${unico()}`);
      const vencida = await api.criarGuia(cliente.id, `Guia vencida com descrição comprida ${unico()}`, 123456.78, dataRelativa(-3));
      await api.criarGuia(cliente.id, `Guia futura ${unico()}`, 10, dataRelativa(20));

      const rotas = [
        "/painel", "/clientes", "/clientes?novo=1", detalhe, "/planos", "/guias", "/guias?novo=1", `/guias?id=${vencida}`, `/clientes?id=${cliente.id}`,
        // notas fiscais (simulação): lista, autorizada, rejeitada com formulário, cancelada, rascunho, nota nova e configuração
        "/notas-fiscais", "/notas-fiscais?id=4", "/notas-fiscais?id=7", "/notas-fiscais?id=3", "/notas-fiscais?id=8", "/notas-fiscais?novo=1",
        "/notas-fiscais/configuracao", `/notas-fiscais/configuracao?cliente=${cliente.id}`, "/financeiro", "/fator-r", `/fator-r?cliente=${cliente.id}`,
      ];
      for (const rota of rotas) {
        await page.goto(rota);
        await expect(page.locator("main")).toBeVisible();
        await page.waitForLoadState("networkidle");
        expect(await foraDaTela(page, viewport.width), `${rota} passa de ${viewport.width}px`).toEqual([]);
      }
    });

    test("guias: a ação principal fica ao alcance do polegar, em linha própria, e lista/detalhe se alternam", async ({ page, request }) => {
      const api = await sessaoApi(request);
      const cliente = await api.criarCliente();
      const descricao = `Mobile ${unico()}`;
      const id = await api.criarGuia(cliente.id, descricao, 100, dataRelativa(-2));

      await page.goto(`/guias?busca=${descricao}`);
      await expect(page.getByRole("region", { name: "Detalhe da guia" })).toBeHidden();
      await page.getByRole("link", { name: new RegExp(descricao) }).click();
      await expect(page).toHaveURL(new RegExp(`id=${id}`));
      await expect(page.getByRole("region", { name: "Lista de guias" })).toBeHidden();

      // "Marcar como paga" ocupa a largura toda numa linha própria (não espreme o título) e cabe na tela.
      const botao = page.getByRole("button", { name: "Marcar como paga" });
      await expect(botao).toBeVisible();
      const caixa = await botao.boundingBox();
      expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(viewport.width);
      expect(caixa!.width).toBeGreaterThan(viewport.width * 0.5);

      await page.getByRole("link", { name: "Voltar para a lista" }).click();
      await expect(page.getByRole("region", { name: "Lista de guias" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Detalhe da guia" })).toBeHidden();
    });

    test("o grupo Fiscal do menu abre no drawer, leva às telas e o drawer fecha", async ({ page }) => {
      const menu = page.getByRole("dialog", { name: "Menu principal" });
      await page.getByRole("button", { name: "Abrir menu" }).click();
      const grupo = menu.getByRole("button", { name: "Fiscal" });
      await expect(grupo).toHaveAttribute("aria-expanded", "false");
      await grupo.click();
      await expect(grupo).toHaveAttribute("aria-expanded", "true");
      await menu.getByRole("link", { name: "Notas fiscais" }).click();
      await expect(page).toHaveURL(/\/notas-fiscais$/);
      await expect(page.getByRole("heading", { name: "Notas fiscais", level: 1 })).toBeVisible();
      await expect(menu.locator("xpath=..")).toHaveAttribute("inert", "");

      // com o menu aberto de novo, o grupo da tela atual já está aberto
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await expect(menu.getByRole("button", { name: "Fiscal" })).toHaveAttribute("aria-expanded", "true");
      await expect(menu.getByRole("link", { name: "Notas fiscais" })).toHaveAttribute("aria-current", "page");
    });

    test("notas fiscais: lista e detalhe se alternam, as ações cabem na tela e os diálogos não passam da largura", async ({ page }) => {
      await page.goto("/notas-fiscais");
      await expect(page.getByRole("region", { name: "Detalhe da nota fiscal" })).toBeHidden();
      await page.getByRole("region", { name: "Lista de notas fiscais" }).getByRole("link", { name: /Marina Ferraz Consultoria.*Autorizada/ }).click();
      await expect(page).toHaveURL(/id=4/);
      await expect(page.getByRole("region", { name: "Lista de notas fiscais" })).toBeHidden();

      // "Baixar PDF" / "Baixar XML" / "⋯" ocupam uma linha própria, abaixo do título, dentro da tela
      const pdf = await page.getByRole("button", { name: "Baixar PDF" }).boundingBox();
      expect(pdf!.x + pdf!.width).toBeLessThanOrEqual(viewport.width);
      const mais = await page.getByRole("button", { name: "Mais ações da nota" }).boundingBox();
      expect(mais!.x + mais!.width).toBeLessThanOrEqual(viewport.width);

      await page.getByRole("button", { name: "Mais ações da nota" }).click();
      await page.getByRole("menuitem", { name: "Cancelar nota" }).click();
      const dialogo = page.getByRole("dialog", { name: "Cancelar a nota fiscal?" });
      await expect(dialogo).toBeVisible();
      const d = await dialogo.boundingBox();
      expect(d!.x).toBeGreaterThanOrEqual(0);
      expect(d!.x + d!.width).toBeLessThanOrEqual(viewport.width);
      expect(await foraDaTela(page, viewport.width)).toEqual([]);
      await expect(dialogo.getByRole("button", { name: "Cancelar nota" })).toBeInViewport(); // o rodapé do diálogo não some em tela baixa
      await page.keyboard.press("Escape");

      await page.getByRole("link", { name: "Voltar para a lista" }).click();
      await expect(page.getByRole("region", { name: "Lista de notas fiscais" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Detalhe da nota fiscal" })).toBeHidden();
    });

    test("notas fiscais: o formulário (com retenções) e o diálogo de revisão cabem na tela", async ({ page, request }) => {
      test.setTimeout(60_000);
      const api = await sessaoApi(request);
      const cliente = await api.criarCliente(`E2E Mobile Nota Com Um Nome Bem Comprido Ltda ${unico()}`);
      await prepararCliente(page, cliente, { canal: "MUNICIPAL_SALVADOR" });
      await page.goto("/notas-fiscais?novo=1");
      await escolherCliente(page, cliente);
      await escolherTomador(page);
      await page.getByText("Retenções federais (opcional)").click();
      await page.getByLabel("Previdência (CP) (R$)").fill("100");
      await page.getByLabel("Valor do serviço (R$)").fill("12.345,67");
      await page.getByLabel("Descrição do serviço").fill("Honorários contábeis com uma descrição bem longa para testar a quebra de linha na revisão da nota fiscal de serviço");
      expect(await foraDaTela(page, viewport.width)).toEqual([]);

      const revisar = await page.getByRole("button", { name: "Revisar e emitir" }).boundingBox();
      expect(revisar!.x + revisar!.width).toBeLessThanOrEqual(viewport.width);
      await page.getByRole("button", { name: "Revisar e emitir" }).click();
      const dialogo = page.getByRole("dialog", { name: "Emitir a nota fiscal?" });
      await expect(dialogo).toBeVisible();
      const d = await dialogo.boundingBox();
      expect(d!.x + d!.width).toBeLessThanOrEqual(viewport.width);
      expect(await foraDaTela(page, viewport.width)).toEqual([]);
      // os botões continuam alcançáveis: o corpo do diálogo rola, mas eles não somem para fora da tela
      await expect(dialogo.getByRole("button", { name: "Emitir nota" })).toBeInViewport();
      await expect(dialogo.getByRole("note").filter({ hasText: "Emissão sem certificado." })).toBeVisible(); // cliente do portal: o aviso está na revisão
    });

    test("configuração fiscal: lista de clientes e dados do cliente se alternam, e as seções cabem na tela", async ({ page, request }) => {
      test.setTimeout(60_000);
      const api = await sessaoApi(request);
      const cliente = await api.criarCliente(`E2E Mobile Fiscal Com Um Nome Bem Comprido Ltda ${unico()}`);
      await page.goto("/notas-fiscais/configuracao");
      await expect(painelDoCliente(page)).toBeHidden();
      await page.getByRole("searchbox", { name: /Buscar cliente/ }).fill(cliente.nome);
      await page.getByRole("region", { name: "Clientes" }).getByRole("link", { name: new RegExp(cliente.nome) }).click();
      await expect(page).toHaveURL(new RegExp(`cliente=${cliente.id}`));
      await expect(page.getByRole("region", { name: "Clientes" })).toBeHidden();
      await expect(painelDoCliente(page)).toBeVisible();

      // com tudo preenchido (credencial do portal e um tomador) o painel continua dentro da largura da tela
      await prepararCliente(page, cliente, { canal: "MUNICIPAL_SALVADOR" });
      expect(await foraDaTela(page, viewport.width)).toEqual([]);
      const salvar = await painelDoCliente(page).getByRole("button", { name: "Testar conexão (Municipal (Salvador))" }).boundingBox();
      expect(salvar!.x + salvar!.width).toBeLessThanOrEqual(viewport.width);

      await painelDoCliente(page).getByRole("button", { name: "Novo tomador" }).click();
      const dialogo = page.getByRole("dialog", { name: "Novo tomador" });
      const d = await dialogo.boundingBox();
      expect(d!.x + d!.width).toBeLessThanOrEqual(viewport.width);
      await expect(dialogo.getByRole("button", { name: "Cadastrar tomador" })).toBeInViewport();
      await page.keyboard.press("Escape");

      await page.getByRole("link", { name: "Voltar para a lista" }).click();
      await expect(page.getByRole("region", { name: "Clientes" })).toBeVisible();
      await expect(painelDoCliente(page)).toBeHidden();
    });

    test("clientes: lista e detalhe se alternam em tela cheia, com botão de voltar", async ({ page }) => {
      const nome = `E2E Mobile ${unico()}`;
      await page.goto("/clientes?novo=1");
      await page.getByLabel("Nome ou razão social").fill(nome);
      await page.getByLabel("CPF ou CNPJ").fill(cpfFake());
      await page.getByRole("button", { name: "Cadastrar" }).click();
      await expect(page.getByText("Cliente cadastrado")).toBeVisible();

      // Detalhe aberto: a lista fica fora da tela (não dividem a largura).
      await expect(page.getByRole("region", { name: "Detalhe do cliente" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Lista de clientes" })).toBeHidden();

      await page.getByRole("link", { name: "Voltar para a lista" }).click();
      await expect(page).toHaveURL(/\/clientes$/);
      await expect(page.getByRole("region", { name: "Lista de clientes" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Detalhe do cliente" })).toBeHidden();

      await page.getByRole("searchbox", { name: "Buscar por nome, CPF/CNPJ ou e-mail" }).fill(nome);
      await page.getByRole("link", { name: new RegExp(nome) }).click();
      await expect(page.getByRole("heading", { name: nome, level: 2 })).toBeVisible();
    });
  });
}
