import type { Marca } from "../../lib/marca/tipos";

/**
 * Marca padrão: ClaudAccount (coral + creme). Contraste AA calculado: texto --ink sobre coral = 4,6:1 (por isso o
 * botão primário usa texto escuro: branco sobre coral daria 3,7:1); texto de acento sobre fundo claro usa o coral
 * escuro (5,7:1). Os testes de src/lib/marca/marca.test.ts conferem todos os pares.
 */
export const marca: Marca = {
  id: "claudaccount",
  nome: "ClaudAccount",
  descricao: "Gestão do escritório de contabilidade: clientes, guias, notas fiscais e documentos.",
  raio: "10px",
  cores: {
    claro: {
      bg: "#faf6f0",
      fg: "#241c1a",
      line: "#e8dfd3",
      paper: "#fffdfa",
      muted: "#76675c",
      accent: "#e8542a",
      accentText: "#b33e1b",
      onAccent: "#241c1a",
      moss: "#2f6b4f",
      amber: "#c9862f",
      amberInk: "#8f5e14",
      crimson: "#b23a3a",
      sidebarBg: "#241c1a",
      sidebarFg: "#f3ece3",
      sidebarMuted: "#b5a79b",
      overlay: "rgb(36 28 26 / 0.55)",
    },
    escuro: {
      bg: "#1a1412",
      fg: "#f3ece3",
      line: "#3a2e29",
      paper: "#221a17",
      muted: "#b0a196",
      accent: "#ff6b3d",
      accentText: "#ff8a5c",
      onAccent: "#1a1412",
      moss: "#6dbe95",
      amber: "#c9862f",
      amberInk: "#e0a64f",
      crimson: "#e27b7b",
      sidebarBg: "#120d0b",
      sidebarFg: "#f3ece3",
      sidebarMuted: "#b5a79b",
      overlay: "rgb(36 28 26 / 0.55)",
    },
  },
};
