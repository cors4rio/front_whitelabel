import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { dataRelativa, PDF_BYTES, sessaoApi } from "./api";
import { entrar, unico } from "./helpers";
import {
  cadastrarTomadorNaConfiguracao,
  enviarCertificado,
  escolherCliente,
  escolherMunicipio,
  escolherTomador,
  painelDoCliente,
  prepararCliente,
  salvarAcessoAoPortal,
  salvarDadosFiscais,
} from "./notas";

// Verificação automática WCAG 2 A/AA (inclui contraste de cor) em claro e escuro. Não substitui teste com
// leitor de tela, mas pega regressão de contraste, rótulo ausente e semântica quebrada.
const TELAS = [
  { nome: "login", rota: "/login", logado: false, espera: "Entre na sua conta" },
  { nome: "painel", rota: "/painel", logado: true, espera: "Painel" },
  { nome: "clientes", rota: "/clientes", logado: true, espera: "Clientes" },
  { nome: "cliente novo", rota: "/clientes?novo=1", logado: true, espera: "Novo cliente" },
  { nome: "planos", rota: "/planos", logado: true, espera: "Planos" },
  { nome: "guias", rota: "/guias", logado: true, espera: "Guias" },
  { nome: "guia nova", rota: "/guias?novo=1", logado: true, espera: "Nova guia" },
  { nome: "notas fiscais", rota: "/notas-fiscais", logado: true, espera: "Notas fiscais" },
  { nome: "nota fiscal nova", rota: "/notas-fiscais?novo=1", logado: true, espera: "Nova nota fiscal" },
  { nome: "configuração fiscal", rota: "/notas-fiscais/configuracao", logado: true, espera: "Configuração fiscal" },
  { nome: "financeiro", rota: "/financeiro", logado: true, espera: "Financeiro" },
  { nome: "fator R", rota: "/fator-r", logado: true, espera: "Fator R" },
];

async function auditar(page: Page) {
  // As listas esmaecem (opacity-70) enquanto atualizam: o contraste só vale com elas assentadas.
  await expect(page.locator(".opacity-70")).toHaveCount(0);
  const resultado = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const resumo = resultado.violations.map((v) => ({
    regra: v.id,
    impacto: v.impact,
    elementos: v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")} :: ${n.failureSummary?.split("\n")[1] ?? ""}`),
  }));
  expect(resumo, JSON.stringify(resumo, null, 2)).toEqual([]);
}

for (const esquema of ["light", "dark"] as const) {
  test.describe(`tema ${esquema}`, () => {
    // O sistema é claro por padrão e ignora a preferência do sistema operacional; o escuro só vale com data-theme="dark".
    test.use({ colorScheme: esquema });
    test.beforeEach(async ({ page }) => {
      if (esquema !== "dark") return;
      await page.addInitScript(() => {
        const marcar = () => document.documentElement.setAttribute("data-theme", "dark");
        if (document.documentElement) marcar();
        else document.addEventListener("readystatechange", marcar, { once: true });
      });
    });

    for (const tela of TELAS) {
      test(`${tela.nome}: sem violações de acessibilidade`, async ({ page }) => {
        if (tela.logado) await entrar(page, tela.rota);
        else await page.goto(tela.rota);
        await expect(page.getByRole("heading", { name: tela.espera }).first()).toBeVisible();
        await auditar(page);
      });
    }

    test("guia: detalhe, anexo, menu '⋯', diálogo de pagamento e combobox de cliente", async ({ page, request }) => {
      const api = await sessaoApi(request);
      const cliente = await api.criarCliente();
      const id = await api.criarGuia(cliente.id, `A11y ${unico()}`, 100, dataRelativa(-2));
      await entrar(page, `/guias?id=${id}`);
      await expect(page.getByRole("heading", { name: /A11y/, level: 2 })).toBeVisible();

      // com PDF anexado (bloco de anexo preenchido) ...
      await page.getByLabel("PDF da guia: escolher arquivo").setInputFiles({ name: "a11y.pdf", mimeType: "application/pdf", buffer: PDF_BYTES });
      await expect(page.getByText("a11y.pdf")).toBeVisible();
      await auditar(page);

      // ... menu aberto ...
      await page.getByRole("button", { name: "Mais ações da guia" }).click();
      await expect(page.getByRole("menu", { name: "Mais ações da guia" })).toBeVisible();
      await auditar(page);
      await page.keyboard.press("Escape");

      // ... diálogo de pagamento ...
      await page.getByRole("button", { name: "Marcar como paga" }).click();
      await expect(page.getByRole("dialog", { name: "Marcar como paga" })).toBeVisible();
      await auditar(page);
      await page.keyboard.press("Escape");

      // ... e o combobox de cliente aberto (com várias opções, a lista rola).
      await page.goto("/guias?novo=1");
      await page.getByRole("combobox", { name: "Cliente", exact: true }).click();
      await expect(page.getByRole("listbox", { name: "Clientes encontrados" })).toBeVisible();
      await auditar(page);
    });

    test("cliente com a seção de guias e guia paga com comprovante: sem violações", async ({ page, request }) => {
      const api = await sessaoApi(request);
      const cliente = await api.criarCliente();
      await api.criarGuia(cliente.id, `A11y cliente ${unico()}`, 100, dataRelativa(3));
      await entrar(page, `/clientes?id=${cliente.id}`);
      await expect(page.getByText("1 em aberto")).toBeVisible();
      await auditar(page);
    });

    test("notas fiscais: autorizada, rejeitada, menu, diálogo de cancelamento e nota em processamento", async ({ page, request }) => {
      test.setTimeout(90_000);
      await page.addInitScript(() => localStorage.setItem("demo-notas:atraso", "6000"));

      // autorizada: arquivos, dados fiscais com a chave, linha do tempo
      await entrar(page, "/notas-fiscais?id=4");
      await expect(page.getByRole("heading", { name: "Marina Ferraz Consultoria", level: 2 })).toBeVisible();
      await auditar(page);

      // ... menu aberto ...
      await page.getByRole("button", { name: "Mais ações da nota" }).click();
      await expect(page.getByRole("menu", { name: "Mais ações da nota" })).toBeVisible();
      await auditar(page);
      await page.getByRole("menuitem", { name: "Cancelar nota" }).click();

      // ... diálogo de cancelamento, vazio e com os erros de validação ...
      const cancelamento = page.getByRole("dialog", { name: "Cancelar a nota fiscal?" });
      await expect(cancelamento).toBeVisible();
      await auditar(page);
      await cancelamento.getByRole("button", { name: "Cancelar nota" }).click();
      await expect(cancelamento.getByText("Escolha o motivo do cancelamento")).toBeVisible();
      await auditar(page);
      await page.keyboard.press("Escape");

      // rejeitada: caixa do motivo + formulário com o campo marcado
      await page.goto("/notas-fiscais?id=7");
      await expect(page.getByRole("region", { name: "Motivo da rejeição" })).toBeVisible();
      await auditar(page);

      // cancelada
      await page.goto("/notas-fiscais?id=3");
      await expect(page.getByRole("group").filter({ hasText: "Cancelamento" })).toBeVisible();
      await auditar(page);

      // em processamento: emite uma nota nova e audita enquanto espera o sistema nacional
      const api = await sessaoApi(request);
      const cliente = await api.criarCliente();
      await prepararCliente(page, cliente);
      await page.goto("/notas-fiscais?novo=1");
      await escolherCliente(page, cliente);
      await escolherTomador(page);
      await page.getByText("Retenções federais (opcional)").click();
      await page.getByLabel("PIS (R$)").fill("6,50");
      await page.getByLabel("Valor do serviço (R$)").fill("100");
      await page.getByLabel("Descrição do serviço").fill("Honorários");
      await page.getByRole("button", { name: "Revisar e emitir" }).click();
      const revisao = page.getByRole("dialog", { name: "Emitir a nota fiscal?" });
      await expect(revisao).toBeVisible();
      await auditar(page); // a revisão da emissão
      await revisao.getByRole("button", { name: "Emitir nota" }).click();
      await expect(page.getByText("Aguardando o sistema nacional.")).toBeVisible();
      await auditar(page);
    });

    test("configuração fiscal: lista, dados do cliente, validação, certificado, portal, tomadores e confirmação de produção", async ({ page, request }) => {
      test.setTimeout(120_000);
      const api = await sessaoApi(request);
      const cliente = await api.criarCliente();
      await entrar(page, "/notas-fiscais/configuracao");
      await expect(page.getByText("Selecione um cliente")).toBeVisible();
      await auditar(page); // lista de clientes e ambiente, sem cliente aberto

      // cliente sem dados fiscais: pendências, formulário vazio e depois com os erros de validação
      await page.goto(`/notas-fiscais/configuracao?cliente=${cliente.id}`);
      const painel = painelDoCliente(page);
      await expect(painel.getByText("Falta resolver 3 itens antes de emitir para este cliente.")).toBeVisible();
      await auditar(page);
      await painel.getByRole("button", { name: "Salvar dados fiscais" }).click();
      await expect(painel.getByText("Escolha o município na lista")).toBeVisible();
      await auditar(page);

      // município sem Emissor Nacional: painel de situação, certificado enviado, teste com falha
      await salvarDadosFiscais(page, cliente, { municipio: "brasilia", rotuloDoMunicipio: /Brasília\/DF/ });
      await auditar(page);
      await enviarCertificado(page);
      await expect(page.getByText("Certificado enviado")).toBeVisible();
      await painel.getByRole("button", { name: "Testar conexão deste cliente" }).click();
      await expect(painel.getByText("O teste não passou.")).toBeVisible();
      await auditar(page);
      await painel.getByRole("button", { name: "Substituir certificado" }).click();
      await enviarCertificado(page, "leia-me.txt", "");
      await expect(painel.getByText("Informe a senha do certificado")).toBeVisible();
      await auditar(page); // com erros de validação no certificado

      // cliente de Salvador, canal municipal (sem certificado): aviso visível e acesso do cliente
      await escolherMunicipio(page, "salvador", /Salvador\/BA/);
      await painel.getByRole("radio", { name: /Municipal de Salvador/ }).check();
      await painel.getByRole("button", { name: "Salvar dados fiscais" }).click();
      await expect(page.getByText("Dados fiscais salvos")).toBeVisible();
      await auditar(page);
      await salvarAcessoAoPortal(page);
      await expect(page.getByText("Acesso ao portal salvo")).toBeVisible();
      await auditar(page);

      // tomadores: lista, diálogo vazio e com erros
      await cadastrarTomadorNaConfiguracao(page);
      await auditar(page);
      await painel.getByRole("button", { name: "Novo tomador" }).click();
      const dialogo = page.getByRole("dialog", { name: "Novo tomador" });
      await auditar(page);
      await dialogo.getByRole("button", { name: "Cadastrar tomador" }).click();
      await expect(dialogo.getByText("Informe um CPF ou CNPJ válido")).toBeVisible();
      await auditar(page);
      await page.keyboard.press("Escape");

      // remoção do acesso: confirmação
      await painel.getByRole("button", { name: "Remover acesso" }).click();
      await expect(page.getByRole("dialog", { name: "Remover o acesso ao portal?" })).toBeVisible();
      await auditar(page);
      await page.keyboard.press("Escape");

      // produção pede confirmação
      await page.getByRole("radio", { name: /Produção/ }).click();
      await expect(page.getByRole("dialog", { name: "Passar para produção?" })).toBeVisible();
      await auditar(page);
      await page.keyboard.press("Escape");
    });

    test("menu: o grupo Fiscal aberto e a command palette com notas fiscais", async ({ page }) => {
      await entrar(page, "/painel");
      await page.getByRole("navigation", { name: "Principal" }).getByRole("button", { name: "Fiscal" }).click();
      await expect(page.getByRole("link", { name: "Notas fiscais" })).toBeVisible();
      await auditar(page);

      await page.keyboard.press("Control+k");
      await page.getByPlaceholder("Buscar cliente, guia, ação ou tela…").fill("oliveira");
      await expect(page.getByRole("option", { name: /Oliveira & Andrade Ltda/ })).toBeVisible();
      await auditar(page);
    });

    test("command palette aberta: sem violações de acessibilidade", async ({ page }) => {
      await entrar(page);
      await page.keyboard.press("Control+k");
      await expect(page.getByRole("dialog", { name: "Buscar clientes, ações e telas" })).toBeVisible();
      await auditar(page);
    });
  });
}

test.describe("tema padrão", () => {
  test.use({ colorScheme: "dark" }); // o computador está em modo escuro

  test("o sistema abre no tema claro mesmo com o sistema operacional escuro", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Entre na sua conta" })).toBeVisible();
    const fundo = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    expect(fundo).toBe("rgb(250, 246, 240)"); // --cream
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("light");
  });
});
