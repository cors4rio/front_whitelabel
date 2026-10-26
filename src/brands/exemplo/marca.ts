import type { Marca } from "../../lib/marca/tipos";

/**
 * Marca de exemplo (azul-petróleo + gelo, logo em SVG). Serve de modelo para criar uma nova marca e de prova, nos
 * testes, de que o front não tem nada da marca padrão preso no código. Para usar: BRAND=exemplo.
 */
export const marca: Marca = {
  id: "exemplo",
  nome: "Contábil Exemplo",
  descricao: "Plataforma de gestão contábil Contábil Exemplo.",
  favicon: "/marcas/exemplo/icone.svg",
  logo: { sobreClaro: "/marcas/exemplo/logo.svg", sobreEscuro: "/marcas/exemplo/logo-claro.svg", altura: 28 },
  raio: "6px",
  cores: {
    claro: {
      bg: "#f2f7f8",
      fg: "#10252b",
      line: "#d3e1e4",
      paper: "#ffffff",
      muted: "#53666c",
      accent: "#14a3a8",
      accentText: "#0b6b70",
      onAccent: "#06232a",
      moss: "#2f6b4f",
      amber: "#c9862f",
      amberInk: "#8f5e14",
      crimson: "#b23a3a",
      sidebarBg: "#0e2a31",
      sidebarFg: "#eaf4f5",
      sidebarMuted: "#9db8bd",
      overlay: "rgb(14 42 49 / 0.55)",
    },
    escuro: {
      bg: "#0b1a1e",
      fg: "#eaf4f5",
      line: "#254049",
      paper: "#10252b",
      muted: "#9db8bd",
      accent: "#2cc4c9",
      accentText: "#5ad8dc",
      onAccent: "#06232a",
      moss: "#6dbe95",
      amber: "#c9862f",
      amberInk: "#e0a64f",
      crimson: "#e27b7b",
      sidebarBg: "#071317",
      sidebarFg: "#eaf4f5",
      sidebarMuted: "#9db8bd",
      overlay: "rgb(14 42 49 / 0.6)",
    },
  },
};
