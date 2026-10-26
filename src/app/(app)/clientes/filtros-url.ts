import type { FiltrosClientes } from "@/lib/queries";
import { comParametros, urlComParametros } from "@/lib/url";

export { comParametros };

/**
 * Os filtros da lista de clientes vivem na URL (?busca=&status=&planoId=&semPlano=&pagina=), não em estado
 * do componente. Com Cache Components o Next mantém a rota anterior montada ao navegar (Activity), então
 * estado inicializado a partir da URL ficaria velho ao voltar por um link. A URL também torna a lista
 * filtrada compartilhável.
 */
export function filtrosDaUrl(params: URLSearchParams): FiltrosClientes {
  const status = params.get("status");
  const planoId = params.get("planoId") ?? "";
  const pagina = Number(params.get("pagina") ?? 0);
  return {
    busca: params.get("busca") ?? "",
    status: status === "ATIVO" || status === "INATIVO" ? status : "",
    planoId: /^\d+$/.test(planoId) ? planoId : "",
    semPlano: params.get("semPlano") === "true",
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 0,
  };
}

export function filtrosParaParametros(params: URLSearchParams, filtros: FiltrosClientes): URLSearchParams {
  return comParametros(params, {
    busca: filtros.busca.trim() || null,
    status: filtros.status || null,
    planoId: filtros.planoId || null,
    semPlano: filtros.semPlano ? "true" : null,
    pagina: filtros.pagina > 0 ? String(filtros.pagina) : null,
  });
}

export const urlClientes = (params: URLSearchParams) => urlComParametros("/clientes", params);
