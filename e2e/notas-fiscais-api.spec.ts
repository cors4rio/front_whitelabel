import { expect, test } from "@playwright/test";

import { certificadoDeTeste, SENHA_DO_CERTIFICADO, sessaoApi } from "./api";
import { entrar } from "./helpers";
import { detalhe, escolherCliente, escolherTomador, lista, painelDoCliente, salvarAcessoAoPortal, salvarDadosFiscais } from "./notas";

/**
 * Notas fiscais no modo "api": o front fala com o backend de verdade (sem a simulação do navegador). Só roda com
 * E2E_NOTAS=api e um front iniciado com NEXT_PUBLIC_NOTAS_FISCAIS=api. Nesta etapa o envio está desligado no backend:
 * a nota é conferida até a confirmação e NADA é enviado ao sistema nacional nem ao portal de Salvador.
 */
test.skip(process.env.E2E_NOTAS !== "api", "só com E2E_NOTAS=api (front em modo api e backend no ar)");
test.setTimeout(90_000);

const PERFIL_CURITIBA = {
  inscricaoMunicipal: null,
  municipioIbge: "4106902",
  opcaoSimples: "ME_EPP",
  regimeEspecial: "NENHUM",
  canal: "NACIONAL",
  serieDps: 1,
  servicoPadrao: null,
};

test.beforeEach(async ({ page }) => {
  await entrar(page, "/notas-fiscais");
});

test("cliente pronto pelo canal nacional: a nota é conferida, mas nada é enviado", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await api.salvarPerfilFiscal(cliente.id, PERFIL_CURITIBA);
  await api.enviarCertificado(cliente.id, certificadoDeTeste(cliente.nome.toUpperCase(), cliente.cpf), SENHA_DO_CERTIFICADO);
  await api.criarTomador(cliente.id, "11.444.777/0001-61", "Loja Aurora Comércio Ltda");

  await page.goto(`/notas-fiscais/configuracao?cliente=${cliente.id}`);
  const painel = painelDoCliente(page);
  await expect(painel.getByText("Este cliente está pronto para emitir.")).toBeVisible();
  await expect(page.getByText(SENHA_DO_CERTIFICADO)).toHaveCount(0);

  await page.goto("/notas-fiscais?novo=1");
  await escolherCliente(page, cliente);
  await escolherTomador(page);
  await page.getByLabel("Valor do serviço (R$)").fill("1.800");
  await page.getByRole("button", { name: /^Usar “Honorários contábeis/ }).click();
  await page.getByRole("button", { name: "Revisar e emitir" }).click();
  await page.getByRole("dialog", { name: "Emitir a nota fiscal?" }).getByRole("button", { name: "Emitir nota" }).click();

  await expect(page.getByText(/nada foi enviado/).first()).toBeVisible();
  await expect(page).toHaveURL(/\/notas-fiscais\?id=\d+/);
  await expect(detalhe(page).getByText("Rascunho", { exact: true }).first()).toBeVisible();
  await expect(detalhe(page).getByText(/Conferida até a confirmação/)).toBeVisible();
  await expect(detalhe(page).getByText("Número da NFS-e")).toHaveCount(0);
  await expect(lista(page).getByRole("link").first()).toContainText(cliente.nome);
});

test("canal municipal: sem a chave do captcha o robô diz que não está configurado e o acesso não é guardado", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await salvarDadosFiscais(page, cliente, { canal: "MUNICIPAL_SALVADOR" });

  await salvarAcessoAoPortal(page);

  await expect(page.getByText(/robô do portal de Salvador não está configurado/).first()).toBeVisible();
  await expect(painelDoCliente(page).getByText(/senha-do-portal/)).toHaveCount(0);
});

test("cliente de outro município não ganha o canal municipal e o tomador novo entra pela tela da nota", async ({ page, request }) => {
  const api = await sessaoApi(request);
  const cliente = await api.criarCliente();
  await api.salvarPerfilFiscal(cliente.id, PERFIL_CURITIBA);

  await page.goto("/notas-fiscais?novo=1");
  await escolherCliente(page, cliente);
  await expect(page.getByRole("group", { name: "Emitir por" })).toHaveCount(0);
});
