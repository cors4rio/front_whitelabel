/**
 * Copia os parâmetros de busca aplicando o patch; valor null/vazio remove a chave. Telas com lista e detalhe
 * guardam tudo (item aberto, filtros, página) na URL — com Cache Components o Next mantém a rota anterior
 * montada ao navegar, então estado inicializado a partir da URL ficaria velho. Ver clientes/filtros-url.ts.
 */
export function comParametros(params: URLSearchParams, patch: Record<string, string | null>): URLSearchParams {
  const novo = new URLSearchParams(params.toString());
  for (const [chave, valor] of Object.entries(patch)) {
    if (valor) novo.set(chave, valor);
    else novo.delete(chave);
  }
  return novo;
}

/** "/rota?a=1" ou só "/rota" quando não há parâmetros. */
export function urlComParametros(rota: string, params: URLSearchParams): string {
  const texto = params.toString();
  return texto ? `${rota}?${texto}` : rota;
}
