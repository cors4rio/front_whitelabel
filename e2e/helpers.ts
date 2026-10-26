import { expect, type Page } from "@playwright/test";

// Credenciais do perfil "dev" do backend (application-dev.yml). Sobrescreva com E2E_EMAIL / E2E_SENHA.
export const EMAIL = process.env.E2E_EMAIL ?? "admin@local.dev";
export const SENHA = process.env.E2E_SENHA ?? "admin1234";

export async function entrar(page: Page, destino = "/painel") {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/painel/);
  if (destino !== "/painel") await page.goto(destino);
}

// Em milissegundos: dois processos de teste iniciados com segundos de diferença não geram documentos sobrepostos
// (com segundos de resolução, a faixa de um chegava a alcançar a do outro e dava 409 de CPF duplicado).
let sequencia = Date.now() % 700_000_000;

/** Sufixo único por execução, para não colidir com dados de execuções anteriores no mesmo banco. */
export const unico = () => `${Date.now().toString(36)}${(sequencia++).toString(36)}`;

function digito(parcial: string, pesoInicial: number): number {
  let soma = 0;
  for (let i = 0; i < parcial.length; i++) soma += Number(parcial[i]) * (pesoInicial - i);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** CPF válido, único por execução (9 dígitos sequenciais + dígitos verificadores), já formatado. */
export function cpfFake(): string {
  let base: string;
  do {
    base = String(100_000_000 + (sequencia++ % 800_000_000));
  } while (new Set(base).size === 1);
  const d1 = digito(base, 10);
  const d2 = digito(base + d1, 11);
  const cpf = base + d1 + d2;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}
