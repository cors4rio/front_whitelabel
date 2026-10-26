import { api, apiBlob, type Opcoes } from "../api";

/**
 * Porta única do módulo de Notas Fiscais para o servidor. No modo "demo" quem responde é a simulação do navegador
 * (carregada sob demanda); nos demais, é a API de verdade. Nenhuma tela sabe a diferença: trocar de modo é uma
 * variável de ambiente, não uma mudança de código.
 *
 * As condições abaixo escrevem `process.env.NEXT_PUBLIC_NOTAS_FISCAIS` por extenso, e não `MODO_NOTAS`: o Next troca
 * esse texto pelo valor no build, e só assim o bundler enxerga o ramo morto e deixa o código da simulação (e os
 * dados fictícios) de fora de um build que não é de demonstração. Uma constante importada de outro módulo não basta.
 */
export async function apiNotas<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  if (process.env.NEXT_PUBLIC_NOTAS_FISCAIS === "demo") {
    const { servidorDemo } = await import("./demo/instancia");
    return servidorDemo().chamar<T>(caminho, opcoes);
  }
  return api<T>(caminho, opcoes);
}

export async function apiNotasBlob(caminho: string): Promise<Blob> {
  if (process.env.NEXT_PUBLIC_NOTAS_FISCAIS === "demo") {
    const { servidorDemo } = await import("./demo/instancia");
    return servidorDemo().chamarBlob(caminho);
  }
  return apiBlob(caminho);
}

/** Apaga o estado da simulação (só existe no modo "demo"). */
export async function reiniciarDemonstracao(): Promise<void> {
  if (process.env.NEXT_PUBLIC_NOTAS_FISCAIS === "demo") {
    const { servidorDemo } = await import("./demo/instancia");
    servidorDemo().reiniciar();
  }
}
