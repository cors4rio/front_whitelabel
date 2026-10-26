import { FILTROS_NOTAS_PADRAO, type FiltrosNotas } from "@/lib/notas/queries";
import type { FiltroStatusNota } from "@/lib/types";
import { comParametros, urlComParametros } from "@/lib/url";

export { comParametros };

const SITUACOES: FiltroStatusNota[] = ["TODAS", "RASCUNHO", "ENVIADA", "AUTORIZADA", "REJEITADA", "CANCELADA"];

/** Tudo que define a tela de Notas fiscais vive na URL (nota aberta, filtros, página): ver clientes/filtros-url.ts. */
export function filtrosNotasDaUrl(params: URLSearchParams): FiltrosNotas {
  const situacao = params.get("situacao") as FiltroStatusNota | null;
  const clienteId = params.get("clienteId") ?? "";
  const mes = params.get("mes") ?? "";
  const pagina = Number(params.get("pagina") ?? 0);
  return {
    busca: params.get("busca") ?? "",
    situacao: situacao && SITUACOES.includes(situacao) ? situacao : FILTROS_NOTAS_PADRAO.situacao,
    clienteId: /^\d+$/.test(clienteId) ? clienteId : "",
    mes: /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : "",
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 0,
  };
}

export function filtrosNotasParaParametros(params: URLSearchParams, filtros: FiltrosNotas): URLSearchParams {
  return comParametros(params, {
    busca: filtros.busca.trim() || null,
    // O padrão (todas) não precisa aparecer na URL.
    situacao: filtros.situacao === FILTROS_NOTAS_PADRAO.situacao ? null : filtros.situacao,
    clienteId: filtros.clienteId || null,
    mes: filtros.mes || null,
    pagina: filtros.pagina > 0 ? String(filtros.pagina) : null,
  });
}

export const urlNotas = (params: URLSearchParams) => urlComParametros("/notas-fiscais", params);
