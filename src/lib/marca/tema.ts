import type { Marca, TokensDeCor } from "./tipos";

const VARIAVEL: Record<keyof TokensDeCor, string> = {
  bg: "--bg",
  fg: "--fg",
  line: "--line",
  paper: "--paper",
  muted: "--muted",
  accent: "--accent",
  accentText: "--accent-text",
  onAccent: "--on-accent",
  moss: "--moss",
  amber: "--amber",
  amberInk: "--amber-ink",
  crimson: "--crimson",
  sidebarBg: "--sidebar-bg",
  sidebarFg: "--sidebar-fg",
  sidebarMuted: "--sidebar-muted",
  overlay: "--overlay",
};

function declaracoes(cores: TokensDeCor): string {
  return (Object.keys(VARIAVEL) as (keyof TokensDeCor)[]).map((k) => `${VARIAVEL[k]}:${cores[k]};`).join("");
}

/**
 * CSS das variáveis da marca. O sistema é claro por padrão e ignora a preferência do sistema operacional;
 * o escuro só vale com <html data-theme="dark"> (ainda sem seletor na tela).
 */
export function temaCss(marca: Marca): string {
  return (
    `:root{${declaracoes(marca.cores.claro)}--radius-ui:${marca.raio};color-scheme:light;}` +
    `:root[data-theme="dark"]{${declaracoes(marca.cores.escuro)}color-scheme:dark;}`
  );
}
