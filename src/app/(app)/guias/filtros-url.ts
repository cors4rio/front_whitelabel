import { FILTROS_GUIAS_PADRAO, type FiltrosGuias } from "@/lib/queries-guias";
import type { FiltroSituacao } from "@/lib/types";
import { comParametros, urlComParametros } from "@/lib/url";

export { comParametros };

const SITUACOES: FiltroSituacao[] = ["EM_ABERTO", "VENCIDA", "VENCENDO", "PAGA", "CANCELADA", "TODAS"];

/** Tudo que define a tela de Guias vive na URL (item aberto, filtros, página): ver clientes/filtros-url.ts. */
export function filtrosGuiasDaUrl(params: URLSearchParams): FiltrosGuias {
  const situacao = params.get("situacao") as FiltroSituacao | null;
  const clienteId = params.get("clienteId") ?? "";
  const pagina = Number(params.get("pagina") ?? 0);
  return {
    busca: params.get("busca") ?? "",
    situacao: situacao && SITUACOES.includes(situacao) ? situacao : FILTROS_GUIAS_PADRAO.situacao,
    clienteId: /^\d+$/.test(clienteId) ? clienteId : "",
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 0,
  };
}

export function filtrosGuiasParaParametros(params: URLSearchParams, filtros: FiltrosGuias): URLSearchParams {
  return comParametros(params, {
    busca: filtros.busca.trim() || null,
    // O padrão (em aberto) não precisa aparecer na URL.
    situacao: filtros.situacao === FILTROS_GUIAS_PADRAO.situacao ? null : filtros.situacao,
    clienteId: filtros.clienteId || null,
    pagina: filtros.pagina > 0 ? String(filtros.pagina) : null,
  });
}

export const urlGuias = (params: URLSearchParams) => urlComParametros("/guias", params);
