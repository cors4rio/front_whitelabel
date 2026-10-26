// Espelho de br.com.auttopus.contabil.common.Documento (backend). O backend é a autoridade; esta cópia
// existe só para dar retorno imediato ao digitar. Suporta o CNPJ alfanumérico (julho/2026): letras nas
// 12 primeiras posições, dígitos verificadores numéricos, cálculo módulo 11 com valor = código ASCII - 48.

const PESOS_CNPJ_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Remove pontuação/espaços e deixa em maiúsculas. */
export function normalizarDocumento(valor: string): string {
  return valor.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

export function documentoValido(valor: string): boolean {
  const doc = normalizarDocumento(valor);
  if (doc.length === 11) return cpfValido(doc);
  if (doc.length === 14) return cnpjValido(doc);
  return false;
}

export function tipoPessoaDoDocumento(valor: string): "PF" | "PJ" | null {
  const tamanho = normalizarDocumento(valor).length;
  if (tamanho === 11) return "PF";
  if (tamanho === 14) return "PJ";
  return null;
}

/** 000.000.000-00 (CPF) ou 00.000.000/0000-00 (CNPJ, inclusive alfanumérico). Parcial enquanto digita. */
export function formatarDocumento(valor: string | null | undefined): string {
  const d = normalizarDocumento(valor ?? "");
  if (d.length <= 11) {
    return d.replace(/^(.{3})(.{1,3})?(.{1,3})?(.{1,2})?$/, (_, a, b, c, e) =>
      [a, b && `.${b}`, c && `.${c}`, e && `-${e}`].filter(Boolean).join(""),
    );
  }
  return d
    .slice(0, 14)
    .replace(/^(.{2})(.{1,3})?(.{1,3})?(.{1,4})?(.{1,2})?$/, (_, a, b, c, e, f) =>
      [a, b && `.${b}`, c && `.${c}`, e && `/${e}`, f && `-${f}`].filter(Boolean).join(""),
    );
}

function todosIguais(doc: string): boolean {
  return new Set(doc).size === 1;
}

function digitoCpf(cpf: string, tamanho: number): number {
  let soma = 0;
  for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || todosIguais(cpf)) return false;
  return digitoCpf(cpf, 9) === Number(cpf[9]) && digitoCpf(cpf, 10) === Number(cpf[10]);
}

function digitoCnpj(cnpj: string, pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < pesos.length; i++) soma += (cnpj.charCodeAt(i) - 48) * pesos[i];
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function cnpjValido(cnpj: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || todosIguais(cnpj)) return false;
  return digitoCnpj(cnpj, PESOS_CNPJ_1) === Number(cnpj[12]) && digitoCnpj(cnpj, PESOS_CNPJ_2) === Number(cnpj[13]);
}
