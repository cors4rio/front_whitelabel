import { dataBR } from "./format.ts";
import type { Guia, TipoGuia } from "./types.ts";

/**
 * O que a pessoa vê numa guia. "Vencida" não existe como status gravado: é a pendente com vencimento passado
 * (o servidor já diz em {@link Guia.vencida}).
 */
export type Situacao = "PENDENTE" | "VENCIDA" | "PAGA" | "CANCELADA";

type Tom = "ok" | "atencao" | "problema" | "neutro";

export function situacaoDaGuia(g: Pick<Guia, "status" | "vencida">): Situacao {
  if (g.status === "PAGA") return "PAGA";
  if (g.status === "CANCELADA") return "CANCELADA";
  return g.vencida ? "VENCIDA" : "PENDENTE";
}

export const ROTULO_TIPO_GUIA: Record<TipoGuia, string> = {
  DAS: "DAS (Simples Nacional)",
  DAS_MEI: "DAS do MEI",
  DARF: "DARF",
  GPS: "GPS (previdência)",
  FGTS: "FGTS",
  DAE_ESOCIAL: "DAE do eSocial",
  DAM_ISS: "ISS da prefeitura (DAM)",
  PARCELAMENTO: "Parcelamento",
  OUTRA: "Outra",
};

export const TIPOS_DE_GUIA = Object.keys(ROTULO_TIPO_GUIA) as TipoGuia[];

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  PENDENTE: "Pendente",
  VENCIDA: "Vencida",
  PAGA: "Paga",
  CANCELADA: "Cancelada",
};

export const TOM_SITUACAO: Record<Situacao, Tom> = {
  PENDENTE: "neutro",
  VENCIDA: "problema",
  PAGA: "ok",
  CANCELADA: "neutro",
};

/**
 * Frase completa sobre o vencimento, em linguagem de gente ("Vence em 3 dias", nunca "D-3"). Só guia pendente
 * tem urgência; a paga e a cancelada dizem o que aconteceu.
 */
export function textoVencimento(g: Pick<Guia, "status" | "diasParaVencimento" | "dataPagamento">): string {
  if (g.status === "PAGA") return g.dataPagamento ? `Paga em ${dataBR(g.dataPagamento)}` : "Paga";
  if (g.status === "CANCELADA") return "Guia cancelada";
  return frasePendente(g.diasParaVencimento);
}

function frasePendente(dias: number): string {
  if (dias < -1) return `Venceu há ${-dias} dias`;
  if (dias === -1) return "Venceu ontem";
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Vence amanhã";
  return `Vence em ${dias} dias`;
}

/**
 * Complemento curto ao lado da data na lista ("há 3 dias", "hoje", "em 2 dias"). Só aparece quando há urgência
 * (vencida ou vencendo): é o texto que acompanha a cor da data, para a urgência nunca depender só da cor.
 */
export function complementoVencimento(g: Pick<Guia, "status" | "vencida" | "vencendo" | "diasParaVencimento">): string {
  if (g.status !== "PENDENTE" || (!g.vencida && !g.vencendo)) return "";
  const dias = g.diasParaVencimento;
  if (dias < -1) return `há ${-dias} dias`;
  if (dias === -1) return "ontem";
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  return `em ${dias} dias`;
}

/** Classe de cor do texto da data: crimson se vencida, âmbar se vencendo, normal nos demais casos. */
export function classeDaData(g: Pick<Guia, "vencida" | "vencendo">): string {
  if (g.vencida) return "text-crimson";
  if (g.vencendo) return "text-amber-ink";
  return "";
}

/** "340 KB", "1,2 MB". */
export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
