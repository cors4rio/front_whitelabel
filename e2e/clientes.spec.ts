import { expect, test, type Page } from "@playwright/test";

import { cpfFake, entrar, unico } from "./helpers";

test.beforeEach(async ({ page }) => {
  await entrar(page, "/clientes");
});

const BUSCA = "Buscar por nome, CPF/CNPJ ou e-mail";

async function cadastrar(page: Page, nome: string, cpf: string, email?: string) {
  await page.getByRole("link", { name: "Novo cliente" }).first().click();
  await expect(page).toHaveURL(/novo=1/);
  await page.getByLabel("Nome ou razão social").fill(nome);
  await page.getByLabel("CPF ou CNPJ").fill(cpf);
  if (email) await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Cadastrar" }).click();
}

test("cadastra, abre pelo link, edita e exclui um cliente", async ({ page }) => {
  const nome = `E2E Cliente ${unico()}`;
  const cpf = cpfFake();

  await cadastrar(page, nome, cpf, "e2e@exemplo.com");
  await expect(page.getByText("Cliente cadastrado")).toBeVisible();
  // Depois de cadastrar, o painel de detalhe passa a ter URL própria (?id=) e o cliente aparece na lista.
  await expect(page).toHaveURL(/\/clientes\?id=\d+/);
  await expect(page.getByRole("heading", { name: nome, level: 2 })).toBeVisible();

  await page.getByLabel(BUSCA).fill(nome);
  const linha = page.getByRole("region", { name: "Lista de clientes" }).getByRole("link", { name: new RegExp(nome) });
  await expect(linha).toHaveCount(1);
  await expect(linha).toHaveAttribute("aria-current", "true");

  // Edita o telefone; o formato brasileiro é aplicado ao sair do campo.
  await page.getByLabel("Telefone").fill("11912345678");
  await page.getByLabel("Telefone").blur();
  await expect(page.getByLabel("Telefone")).toHaveValue("(11) 91234-5678");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Cliente salvo")).toBeVisible();

  // O link do cliente funciona num carregamento novo da página.
  await page.reload();
  await expect(page.getByLabel("Telefone")).toHaveValue("(11) 91234-5678");

  await page.getByRole("button", { name: "Excluir cliente" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir cliente" }).click();
  await expect(page.getByText("Cliente excluído")).toBeVisible();
  // Volta para a lista preservando a busca que estava na URL: o que importa é sair do cliente excluído.
  await expect(page).toHaveURL(/\/clientes(\?|$)/);
  await expect(page).not.toHaveURL(/id=\d+/);

  await page.getByLabel(BUSCA).fill(nome);
  await expect(page.getByText("Nenhum cliente encontrado")).toBeVisible();
});

test("valida CPF/CNPJ e avisa documento duplicado, com o erro junto ao campo", async ({ page }) => {
  await page.getByRole("link", { name: "Novo cliente" }).first().click();
  await page.getByLabel("Nome ou razão social").fill("Qualquer");
  await page.getByLabel("CPF ou CNPJ").fill("11111111111");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("CPF ou CNPJ inválido")).toBeVisible();
  await expect(page.getByLabel("CPF ou CNPJ")).toBeFocused();

  const cpf = cpfFake();
  const nome = `E2E Duplicado ${unico()}`;
  await cadastrar(page, nome, cpf);
  await expect(page.getByText("Cliente cadastrado")).toBeVisible();

  await cadastrar(page, `${nome} 2`, cpf);
  await expect(page.getByText(/Já existe um cliente com esse CPF\/CNPJ/)).toBeVisible();
});

test("aceita o CNPJ alfanumérico e mostra o tipo de pessoa", async ({ page }) => {
  await page.getByRole("link", { name: "Novo cliente" }).first().click();
  await page.getByLabel("CPF ou CNPJ").fill("12abc34501de35");
  await expect(page.getByLabel("CPF ou CNPJ")).toHaveValue("12.ABC.345/01DE-35");
  await expect(page.getByText("Pessoa jurídica")).toBeVisible();
});

test("importa um CSV: verifica, mostra os erros por linha e só grava ao confirmar", async ({ page }) => {
  const nome = `E2E Importado ${unico()}`;
  const csv = `nome;cpf_cnpj;email\n${nome};${cpfFake()};imp@exemplo.com\nSem documento valido;123.456.789-00;\n`;

  await page.getByRole("link", { name: "Importar CSV" }).first().click();
  await expect(page.getByRole("dialog", { name: "Importar clientes" })).toBeVisible();
  await page.getByLabel("Arquivo CSV de clientes").setInputFiles({
    name: "clientes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf-8"),
  });

  await expect(page.getByText("pronto para importar")).toBeVisible();
  await expect(page.getByText("linha com erro")).toBeVisible();
  const erro = page.getByRole("row", { name: /123\.456\.789-00/ });
  await expect(erro).toContainText("CPF ou CNPJ inválido");
  await expect(erro.getByRole("cell").first()).toHaveText("3");

  // Ainda não gravou nada.
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.getByLabel(BUSCA).fill(nome);
  await expect(page.getByText("Nenhum cliente encontrado")).toBeVisible();

  await page.getByRole("link", { name: "Importar CSV" }).first().click();
  await page.getByLabel("Arquivo CSV de clientes").setInputFiles({
    name: "clientes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf-8"),
  });
  await page.getByRole("button", { name: "Importar 1" }).click();
  await expect(page.getByText("1 cliente importado")).toBeVisible();

  await page.getByLabel(BUSCA).fill(nome);
  await expect(page.getByRole("region", { name: "Lista de clientes" }).getByRole("link", { name: new RegExp(nome) })).toHaveCount(1);
});

test("cria um plano, vincula ao cliente e o filtro 'sem plano' funciona", async ({ page }) => {
  const plano = `Plano E2E ${unico()}`;
  await page.goto("/planos");
  await page.getByRole("button", { name: "Novo plano" }).first().click();
  await page.getByLabel("Nome").fill(plano);
  await page.getByLabel("Valor mensal (R$)").fill("199,90");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("Plano cadastrado")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: plano })).toContainText("R$ 199,90");

  await page.goto("/clientes");
  const nome = `E2E ComPlano ${unico()}`;
  await cadastrar(page, nome, cpfFake());
  await expect(page.getByText("Cliente cadastrado")).toBeVisible();
  await page.getByLabel("Plano", { exact: true }).selectOption({ label: plano });
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Cliente salvo")).toBeVisible();

  await page.getByLabel(BUSCA).fill(nome);
  await expect(page.getByRole("region", { name: "Lista de clientes" }).getByRole("link", { name: new RegExp(`${nome}.*${plano}`) })).toHaveCount(1);
  await page.getByLabel("Filtrar por plano").selectOption("sem");
  await expect(page.getByText("Nenhum cliente encontrado")).toBeVisible();
});

test("o Painel mostra a receita prevista e leva aos clientes sem plano", async ({ page }) => {
  await cadastrar(page, `E2E SemPlano ${unico()}`, cpfFake());
  await expect(page.getByText("Cliente cadastrado")).toBeVisible();

  await page.getByRole("link", { name: "Painel" }).click();
  await expect(page.getByText("Receita mensal prevista")).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "sem plano" }).getByRole("link", { name: "Ver quais" }).click();
  await expect(page).toHaveURL(/status=ATIVO&semPlano=true/);
  await expect(page.getByLabel("Filtrar por plano")).toHaveValue("sem");
});

test("command palette: Ctrl+K encontra um cliente e abre o detalhe só pelo teclado", async ({ page }) => {
  const nome = `E2E Paleta ${unico()}`;
  await cadastrar(page, nome, cpfFake());
  await expect(page.getByText("Cliente cadastrado")).toBeVisible();
  await page.goto("/painel");
  // O atalho só existe depois que a página hidratou e a sessão foi recuperada.
  await expect(page.getByRole("heading", { name: "Painel", level: 1 })).toBeVisible();

  await page.keyboard.press("Control+k");
  const paleta = page.getByRole("dialog", { name: "Buscar clientes, ações e telas" });
  await expect(paleta).toBeVisible();

  await page.getByPlaceholder("Buscar cliente, guia, ação ou tela…").fill(nome);
  // "^": com o módulo de notas ligado a palette também oferece "Emitir nota para <cliente>"; o resultado é o cliente em si.
  await expect(paleta.getByRole("option", { name: new RegExp(`^${nome}`) })).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/clientes\?id=\d+/);
  await expect(page.getByRole("heading", { name: nome, level: 2 })).toBeVisible();

  await page.keyboard.press("Control+k");
  await expect(paleta).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(paleta).toBeHidden();
});
