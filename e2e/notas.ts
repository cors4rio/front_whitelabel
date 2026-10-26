import { expect, type Page } from "@playwright/test";

import type { ClienteCriado } from "./api";

/**
 * Apoio aos testes de Notas fiscais (modo "demo": a simulação roda no navegador). Cada teste tem um navegador novo,
 * então começa nas 8 notas de exemplo, sem perfis fiscais e sem tomadores: quem emite precisa preparar o cliente pela tela.
 *
 * Dois canais de emissão: NACIONAL (certificado do cliente, qualquer município liberado, o padrão) e
 * MUNICIPAL_SALVADOR (portal da prefeitura, sem certificado, só cliente de Salvador).
 */

export type Canal = "NACIONAL" | "MUNICIPAL_SALVADOR";

export const lista = (page: Page) => page.getByRole("region", { name: "Lista de notas fiscais" });
export const detalhe = (page: Page) => page.getByRole("region", { name: "Detalhe da nota fiscal" });
export const painelDoCliente = (page: Page) => page.getByRole("region", { name: "Dados fiscais do cliente" });
/** Uma seção do painel (o <details>), achada pelo título dela: filtrar pelo texto pegaria também as que a citam. */
export const secaoDoPainel = (page: Page, titulo: string) =>
  painelDoCliente(page).locator("details").filter({ has: page.locator("summary", { hasText: titulo }) });

/** Encurta a espera do "sistema nacional" da simulação (padrão: 2,5 s; pelo canal municipal, o triplo). */
export async function agilizar(page: Page, ms = 300) {
  await page.addInitScript((atraso) => localStorage.setItem("demo-notas:atraso", String(atraso)), ms);
}

export const TOMADOR_PADRAO = { documento: "11.444.777/0001-61", nome: "Loja Aurora Comércio Ltda" };

/** Escolhe o município do cliente na tela de dados fiscais (já aberta). */
export async function escolherMunicipio(page: Page, busca: string, rotulo: RegExp) {
  await painelDoCliente(page).getByRole("combobox", { name: "Município do cliente" }).fill(busca);
  await page.getByRole("listbox", { name: "Municípios encontrados" }).getByRole("option", { name: rotulo }).click();
}

/** Abre os dados fiscais do cliente e salva município, regime e canal padrão. O canal municipal exige Salvador. */
export async function salvarDadosFiscais(
  page: Page,
  cliente: ClienteCriado,
  { canal = "NACIONAL", municipio, rotuloDoMunicipio }: { canal?: Canal; municipio?: string; rotuloDoMunicipio?: RegExp } = {},
) {
  const salvador = canal === "MUNICIPAL_SALVADOR";
  await page.goto(`/notas-fiscais/configuracao?cliente=${cliente.id}`);
  const painel = painelDoCliente(page);
  await expect(painel.getByRole("heading", { name: cliente.nome, level: 2 })).toBeVisible();
  await escolherMunicipio(page, municipio ?? (salvador ? "salvador" : "curitiba"), rotuloDoMunicipio ?? (salvador ? /Salvador\/BA/ : /Curitiba\/PR/));
  await painel.getByLabel("Regime tributário").selectOption("ME_EPP");
  if (salvador) await painel.getByRole("radio", { name: /Municipal de Salvador/ }).check();
  await painel.getByRole("button", { name: "Salvar dados fiscais" }).click();
  await expect(page.getByText("Dados fiscais salvos")).toBeVisible();
}

export async function enviarCertificado(page: Page, nome = "cliente.pfx", senha = "segredo") {
  const painel = painelDoCliente(page);
  await painel.getByLabel("Arquivo do certificado A1 do cliente").setInputFiles({ name: nome, mimeType: "application/octet-stream", buffer: Buffer.from("conteudo") });
  await painel.getByLabel("Senha do certificado").fill(senha);
  await painel.getByRole("button", { name: "Enviar certificado" }).click();
}

export async function salvarAcessoAoPortal(page: Page, usuario = "usuario.portal", senha = "senha-do-portal") {
  const painel = painelDoCliente(page);
  await painel.getByLabel("Usuário no portal (CNPJ ou CPF)").fill(usuario);
  await painel.getByLabel("Senha no portal").fill(senha);
  await painel.getByRole("button", { name: "Salvar acesso ao portal" }).click();
}

/** Na tela de dados fiscais do cliente: cadastra um tomador pela seção Tomadores. */
export async function cadastrarTomadorNaConfiguracao(page: Page, tomador = TOMADOR_PADRAO) {
  await painelDoCliente(page).getByRole("button", { name: "Novo tomador" }).click();
  const dialogo = page.getByRole("dialog", { name: "Novo tomador" });
  await dialogo.getByLabel("CPF ou CNPJ").fill(tomador.documento);
  await dialogo.getByLabel("Nome ou razão social").fill(tomador.nome);
  await dialogo.getByRole("button", { name: "Cadastrar tomador" }).click();
  await expect(page.getByText("Tomador cadastrado")).toBeVisible();
  await expect(dialogo).toBeHidden();
}

/**
 * Deixa o cliente pronto para emitir pelo canal pedido: dados fiscais, a credencial do canal (certificado ou acesso ao
 * portal) e um tomador na lista. Cliente de Salvador com canal municipal fica sem o certificado (o nacional não serve a ele).
 */
export async function prepararCliente(page: Page, cliente: ClienteCriado, opcoes: { canal?: Canal; tomador?: typeof TOMADOR_PADRAO } = {}) {
  const canal = opcoes.canal ?? "NACIONAL";
  await salvarDadosFiscais(page, cliente, { canal });
  if (canal === "MUNICIPAL_SALVADOR") {
    await salvarAcessoAoPortal(page);
    await expect(page.getByText("Acesso ao portal salvo")).toBeVisible();
  } else {
    await enviarCertificado(page);
    await expect(page.getByText("Certificado enviado")).toBeVisible();
  }
  await cadastrarTomadorNaConfiguracao(page, opcoes.tomador);
  const pronto = canal === "MUNICIPAL_SALVADOR" ? "Pronto para emitir pelo canal municipal (salvador)." : "Este cliente está pronto para emitir.";
  await expect(painelDoCliente(page).getByText(pronto)).toBeVisible();
}

export async function escolherCliente(page: Page, cliente: ClienteCriado) {
  await page.getByRole("combobox", { name: "Cliente (prestador)" }).fill(cliente.cpf);
  await page.getByRole("listbox", { name: "Clientes encontrados" }).getByRole("option", { name: new RegExp(cliente.nome) }).click();
}

export async function escolherTomador(page: Page, nome = TOMADOR_PADRAO.nome) {
  await page.getByRole("combobox", { name: "Tomador" }).fill(nome.split(" ")[0]);
  await page.getByRole("listbox", { name: "Tomadores encontrados" }).getByRole("option", { name: new RegExp(nome) }).click();
}

export async function escolherServico(page: Page, codigo: string) {
  await page.getByRole("combobox", { name: "Serviço prestado" }).fill(codigo);
  await page.getByRole("listbox", { name: "Serviços da lista nacional" }).getByRole("option", { name: new RegExp(`^${codigo.replace(/\./g, "\\.")}`) }).click();
}

/** Preenche a nota nova (cliente já preparado) até o botão de revisar. */
export async function preencherNota(page: Page, cliente: ClienteCriado, { valor = "1.000", servico }: { valor?: string; servico?: string } = {}) {
  await page.goto("/notas-fiscais?novo=1");
  await escolherCliente(page, cliente);
  await escolherTomador(page);
  await page.getByLabel("Valor do serviço (R$)").fill(valor);
  await page.getByRole("button", { name: /^Usar “Honorários contábeis/ }).click();
  if (servico) await escolherServico(page, servico);
}

/** Preenche e emite uma nota nova até a tela de detalhe. Devolve o id da nota. */
export async function emitirNota(page: Page, cliente: ClienteCriado, opcoes: { valor?: string; servico?: string } = {}): Promise<number> {
  await preencherNota(page, cliente, opcoes);
  await page.getByRole("button", { name: "Revisar e emitir" }).click();
  await page.getByRole("dialog", { name: "Emitir a nota fiscal?" }).getByRole("button", { name: "Emitir nota" }).click();
  await expect(page).toHaveURL(/\/notas-fiscais\?id=\d+/);
  return Number(new URL(page.url()).searchParams.get("id"));
}
