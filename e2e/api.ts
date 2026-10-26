import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { APIRequestContext } from "@playwright/test";

import { cpfFake, EMAIL, SENHA, unico } from "./helpers";

/** PDF e PNG mínimos: o backend decide o tipo pelos primeiros bytes, não pelo nome. */
export const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF", "ascii");
export const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

/** AAAA-MM-DD de hoje + {@code dias}, no fuso do escritório (o mesmo que o servidor usa para "vencida"). */
export function dataRelativa(dias: number): string {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const [ano, mes, dia] = hoje.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** AAAA-MM de {@code meses} meses atrás (0 = o mês corrente), no fuso do escritório. */
export function mesRelativo(meses: number): string {
  const [ano, mes] = dataRelativa(0).split("-").map(Number);
  const indice = ano * 12 + (mes - 1) - meses;
  return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, "0")}`;
}

/** "2026-10-15" -> "15/10/2026" */
export const dataBR = (iso: string) => iso.split("-").reverse().join("/");

export interface ClienteCriado {
  id: number;
  nome: string;
  cpf: string;
}

/**
 * Cria dados pela API (login próprio, sem relação com o navegador do teste). Montar o cenário por aqui deixa
 * os testes de tela rápidos e focados no que realmente verificam.
 */
export async function sessaoApi(request: APIRequestContext) {
  const login = await request.post("/api/v1/auth/login", { data: { email: EMAIL, senha: SENHA } });
  const { accessToken } = (await login.json()) as { accessToken: string };
  const headers = { Authorization: `Bearer ${accessToken}` };

  return {
    async criarCliente(nome = `E2E Cliente ${unico()}`): Promise<ClienteCriado> {
      const cpf = cpfFake();
      const resposta = await request.post("/api/v1/clientes", { headers, data: { nomeRazaoSocial: nome, cpfCnpj: cpf } });
      if (!resposta.ok()) throw new Error(`falha ao criar cliente: ${resposta.status()} ${await resposta.text()}`);
      return { id: ((await resposta.json()) as { id: number }).id, nome, cpf };
    },

    async criarGuia(clienteId: number, descricao: string, valor: number, vencimento: string, tipo?: string): Promise<number> {
      const resposta = await request.post("/api/v1/guias", { headers, data: { clienteId, descricao, valor, vencimento, ...(tipo ? { tipo } : {}) } });
      if (!resposta.ok()) throw new Error(`falha ao criar guia: ${resposta.status()} ${await resposta.text()}`);
      return ((await resposta.json()) as { id: number }).id;
    },

    /** Dados fiscais do cliente (módulo de notas no modo "api"). */
    async salvarPerfilFiscal(clienteId: number, dados: Record<string, unknown>): Promise<void> {
      const resposta = await request.put(`/api/v1/perfis-fiscais/${clienteId}`, { headers, data: dados });
      if (!resposta.ok()) throw new Error(`falha ao salvar o perfil fiscal: ${resposta.status()} ${await resposta.text()}`);
    },

    async enviarCertificado(clienteId: number, p12: Buffer, senha: string): Promise<void> {
      const resposta = await request.put(`/api/v1/perfis-fiscais/${clienteId}/certificado`, {
        headers,
        multipart: { arquivo: { name: "cliente.pfx", mimeType: "application/octet-stream", buffer: p12 }, senha },
      });
      if (!resposta.ok()) throw new Error(`falha ao enviar o certificado: ${resposta.status()} ${await resposta.text()}`);
    },

    async criarTomador(clienteId: number, documento: string, nome: string): Promise<number> {
      const resposta = await request.post(`/api/v1/perfis-fiscais/${clienteId}/tomadores`, { headers, data: { documento, nome, email: null } });
      if (!resposta.ok()) throw new Error(`falha ao criar o tomador: ${resposta.status()} ${await resposta.text()}`);
      return ((await resposta.json()) as { id: number }).id;
    },

    /** Folha e/ou receita de um mês do cliente, para o Fator R. */
    async informarMesDoFatorR(clienteId: number, competencia: string, folha: number | null, receita: number | null): Promise<void> {
      const resposta = await request.put(`/api/v1/fator-r/clientes/${clienteId}/meses/${competencia}`, { headers, data: { folha, receita } });
      if (!resposta.ok()) throw new Error(`falha ao informar o mês do Fator R: ${resposta.status()} ${await resposta.text()}`);
    },

    async cancelarGuia(id: number): Promise<void> {
      const resposta = await request.post(`/api/v1/guias/${id}/cancelar`, { headers });
      if (!resposta.ok()) throw new Error(`falha ao cancelar guia: ${resposta.status()}`);
    },
  };
}

export const SENHA_DO_CERTIFICADO = "segredo-do-certificado";

/** Certificado A1 de teste (PKCS#12 autoassinado) feito com o keytool do JDK: "RAZAO:DOCUMENTO" no nome comum, como a ICP-Brasil. */
export function certificadoDeTeste(razaoSocial: string, documento: string, dias = 365): Buffer {
  const pasta = mkdtempSync(join(tmpdir(), "cert-e2e-"));
  const arquivo = join(pasta, "certificado.p12");
  const keytool = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, "bin", "keytool") : "keytool";
  try {
    execFileSync(
      keytool,
      [
        "-genkeypair", "-alias", "a1", "-keyalg", "RSA", "-keysize", "2048", "-validity", String(dias),
        "-dname", `CN=${razaoSocial}:${documento.replace(/\D/g, "")}, OU=Teste, O=ICP-Brasil de Teste, C=BR`,
        "-storetype", "PKCS12", "-keystore", arquivo, "-storepass", SENHA_DO_CERTIFICADO, "-keypass", SENHA_DO_CERTIFICADO,
      ],
      { stdio: "pipe" },
    );
    return readFileSync(arquivo);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}
