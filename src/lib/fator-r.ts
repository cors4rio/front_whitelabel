import type { ResultadoFatorR } from "./types.ts";

/** 0,285 -> "28,50%"; null (sem base) -> "—". */
export function formatarFator(fator: number | null): string {
  if (fator === null) return "—";
  return `${(fator * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/** Quantos dos 12 meses entraram na conta: "12 meses", "8 de 12 meses", "nenhum mês". */
export function rotuloDaBase(r: Pick<ResultadoFatorR, "mesesConsiderados" | "completo">): string {
  if (r.completo) return "12 meses";
  if (r.mesesConsiderados === 0) return "nenhum mês";
  return `${r.mesesConsiderados} de 12 meses`;
}

/** O texto curto do anexo para tela e leitor de tela: "Anexo III", "Anexo V" ou "Sem base". */
export function rotuloDoAnexo(anexo: ResultadoFatorR["anexo"]): string {
  return anexo === null ? "Sem base" : `Anexo ${anexo}`;
}
