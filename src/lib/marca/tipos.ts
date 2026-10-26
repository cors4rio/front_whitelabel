/** Cores de uma aparência (clara ou escura). Todas hexadecimais (#rrggbb), exceto `overlay`, que é rgb() com transparência. */
export type TokensDeCor = {
  /** Fundo da página. */
  bg: string;
  /** Texto principal. */
  fg: string;
  /** Bordas e divisórias. */
  line: string;
  /** Superfície de cartões e formulários. */
  paper: string;
  /** Texto secundário. */
  muted: string;
  /** Cor da marca: fundo do botão primário. */
  accent: string;
  /** Cor da marca usada como TEXTO sobre `bg`/`paper` (links, destaques). */
  accentText: string;
  /** Texto sobre `accent`. */
  onAccent: string;
  /** Sucesso. */
  moss: string;
  /** Alerta (preenchimentos). */
  amber: string;
  /** Alerta (texto). */
  amberInk: string;
  /** Erro. */
  crimson: string;
  sidebarBg: string;
  sidebarFg: string;
  sidebarMuted: string;
  overlay: string;
};

/**
 * Identidade visual de uma instalação (whitelabel por build: variável BRAND, ver README).
 * A assinatura "Desenvolvido por AUTTOPUS" NÃO faz parte da marca: aparece em todas as instalações.
 */
export type Marca = {
  /** Mesmo nome da pasta em src/brands. */
  id: string;
  /** Nome exibido na interface e no título da aba. */
  nome: string;
  /** Descrição do site (metadata). */
  descricao: string;
  /** Caminho em /public do ícone da aba (opcional; sem ele vale o src/app/favicon.ico). */
  favicon?: string;
  /** Logotipo em /public (opcional; sem ele a interface mostra o nome em texto). */
  logo?: {
    /** Versão para fundo claro (login, topo no celular). */
    sobreClaro: string;
    /** Versão para fundo escuro (menu lateral). */
    sobreEscuro: string;
    /** Altura em px; a largura acompanha. */
    altura: number;
  };
  /** Raio dos cantos de botões, campos e cartões. */
  raio: string;
  cores: { claro: TokensDeCor; escuro: TokensDeCor };
};
