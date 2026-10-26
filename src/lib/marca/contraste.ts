import type { Marca, TokensDeCor } from "./tipos";

/** Luminância relativa (WCAG 2) de uma cor #rrggbb. */
function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG 2 entre duas cores #rrggbb (1 a 21). */
export function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

/** Pares texto/fundo que a interface realmente usa. Todos precisam de 4,5:1 (WCAG AA, texto normal). */
const PARES: [texto: keyof TokensDeCor, fundo: keyof TokensDeCor][] = [
  ["fg", "bg"],
  ["fg", "paper"],
  ["muted", "bg"],
  ["muted", "paper"],
  ["accentText", "bg"],
  ["accentText", "paper"],
  ["onAccent", "accent"],
  ["moss", "bg"],
  ["moss", "paper"],
  ["amberInk", "bg"],
  ["amberInk", "paper"],
  ["crimson", "bg"],
  ["crimson", "paper"],
  ["sidebarFg", "sidebarBg"],
  ["sidebarMuted", "sidebarBg"],
];

const HEX = /^#[0-9a-f]{6}$/i;

/** Problemas de acessibilidade/formato de uma marca; lista vazia = pode usar. */
export function problemasDaMarca(marca: Marca): string[] {
  const problemas: string[] = [];
  for (const aparencia of ["claro", "escuro"] as const) {
    const cores = marca.cores[aparencia];
    const invalidas = Object.entries(cores).filter(([nome, valor]) => nome !== "overlay" && !HEX.test(valor));
    for (const [nome, valor] of invalidas) problemas.push(`${aparencia}.${nome}: "${valor}" não é #rrggbb`);
    if (invalidas.length) continue;
    for (const [texto, fundo] of PARES) {
      const razao = contraste(cores[texto], cores[fundo]);
      if (razao < 4.5) problemas.push(`${aparencia}: ${texto} sobre ${fundo} = ${razao.toFixed(2)}:1 (mínimo 4,5:1)`);
    }
  }
  return problemas;
}
