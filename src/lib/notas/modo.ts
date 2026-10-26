/**
 * Como o módulo de Notas Fiscais funciona neste build (NEXT_PUBLIC_NOTAS_FISCAIS, gravada no build):
 *  - "demo": simulação no navegador, com dados fictícios. É o padrão em desenvolvimento enquanto o backend do
 *    módulo não existe; nada é enviado à Receita.
 *  - "api": fala com o backend de verdade (/api/v1/notas-fiscais).
 *  - "desligado": o módulo some do menu e das rotas. É o padrão de um build de produção.
 * O valor padrão de cada ambiente está em next.config.ts.
 */
export type ModoNotas = "demo" | "api" | "desligado";

const configurado = process.env.NEXT_PUBLIC_NOTAS_FISCAIS;

export const MODO_NOTAS: ModoNotas = configurado === "demo" || configurado === "api" ? configurado : "desligado";

export const NOTAS_FISCAIS_ATIVAS = MODO_NOTAS !== "desligado";
