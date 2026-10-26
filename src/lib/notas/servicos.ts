import { SERVICOS_NACIONAIS } from "./dados/servicos-nacionais.ts";

export interface Servico {
  codigo: string;
  descricao: string;
}

/** 17.19.01 — Contabilidade, inclusive serviços técnicos e auxiliares: o serviço do escritório. */
export const SERVICO_CONTABIL = "171901";

/** O que se oferece antes de a pessoa digitar: os serviços que um escritório contábil costuma prestar. */
const SUGESTOES = [SERVICO_CONTABIL, "172001", "171601", "170101"];

const semAcento = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

const porCodigo = new Map(SERVICOS_NACIONAIS.map(([codigo, descricao]) => [codigo, descricao]));

/** "171901" → "17.19.01" (item, subitem, desdobro da LC 116/2003). */
export function formatarCodigoServico(codigo: string): string {
  return /^\d{6}$/.test(codigo) ? `${codigo.slice(0, 2)}.${codigo.slice(2, 4)}.${codigo.slice(4)}` : codigo;
}

export function descricaoDoServico(codigo: string): string | null {
  return porCodigo.get(codigo) ?? null;
}

export function servicoPorCodigo(codigo: string): Servico | null {
  const descricao = porCodigo.get(codigo);
  return descricao ? { codigo, descricao } : null;
}

/**
 * Busca na lista nacional pelo código (com ou sem pontos) ou por palavras da descrição, sem ligar para acento.
 * Sem texto, devolve as sugestões do escritório contábil.
 */
export function buscarServicos(termo: string, limite = 8): Servico[] {
  const t = semAcento(termo).trim();
  if (!t) {
    return SUGESTOES.map((codigo) => servicoPorCodigo(codigo)).filter((s): s is Servico => s !== null);
  }

  const digitos = t.replace(/\D/g, "");
  const palavras = t.split(/\s+/).filter(Boolean);
  const achados: { servico: Servico; peso: number }[] = [];

  for (const [codigo, descricao] of SERVICOS_NACIONAIS) {
    const texto = semAcento(descricao);
    let peso = -1;
    if (digitos.length >= 2 && /^[\d.\s]+$/.test(t) && codigo.startsWith(digitos)) peso = 0;
    else if (palavras.every((p) => texto.includes(p))) peso = texto.startsWith(palavras[0]) ? 1 : 2;
    if (peso >= 0) achados.push({ servico: { codigo, descricao }, peso });
  }
  return achados
    .sort((a, b) => a.peso - b.peso || a.servico.codigo.localeCompare(b.servico.codigo))
    .slice(0, limite)
    .map((a) => a.servico);
}
