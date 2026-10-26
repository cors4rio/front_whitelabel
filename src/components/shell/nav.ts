import { Barcode, CurrencyCircleDollar, FileText, Percent, Receipt, SquaresFour, UsersThree } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

import { NOTAS_FISCAIS_ATIVAS } from "@/lib/notas/modo";

export interface ItemNav {
  rotulo: string;
  href: string;
  icone: Icon;
}

/** Grupo com submenu: abrir um grupo recolhe os outros (docs/ui-ux.md, seção 5). */
export interface GrupoNav {
  rotulo: string;
  icone: Icon;
  itens: ItemNav[];
}

export type EntradaNav = ItemNav | GrupoNav;

export const ehGrupo = (entrada: EntradaNav): entrada is GrupoNav => "itens" in entrada;

const PAINEL: ItemNav = { rotulo: "Painel", href: "/painel", icone: SquaresFour };
const CLIENTES: ItemNav = { rotulo: "Clientes", href: "/clientes", icone: UsersThree };
const GUIAS: ItemNav = { rotulo: "Guias", href: "/guias", icone: Barcode };
const NOTAS: ItemNav = { rotulo: "Notas fiscais", href: "/notas-fiscais", icone: FileText };
const FINANCEIRO: ItemNav = { rotulo: "Financeiro", href: "/financeiro", icone: CurrencyCircleDollar };
const FATOR_R: ItemNav = { rotulo: "Fator R", href: "/fator-r", icone: Percent };
const PLANOS: ItemNav = { rotulo: "Planos", href: "/planos", icone: Receipt };

/**
 * Só entram aqui telas que existem de verdade: o legado tinha itens de menu que levavam a lugar nenhum
 * (achado #3.3) e isso não se repete. Quando um módulo novo ficar pronto, ele ganha a sua linha.
 *
 * "Fiscal" (Notas fiscais + Guias) é o primeiro grupo com submenu. Com o módulo de notas desligado ele teria um
 * item só, e um grupo de um item só atrapalha: nesse caso Guias volta a ser uma linha comum.
 */
export function entradasDoMenu(comNotasFiscais: boolean): EntradaNav[] {
  return [
    PAINEL,
    CLIENTES,
    comNotasFiscais ? { rotulo: "Fiscal", icone: FileText, itens: [NOTAS, GUIAS] } : GUIAS,
    FINANCEIRO,
    FATOR_R,
    PLANOS,
  ];
}

export const ENTRADAS_NAV: EntradaNav[] = entradasDoMenu(NOTAS_FISCAIS_ATIVAS);

/** Todas as telas navegáveis, sem a estrutura de grupos: é o que a command palette lista em "Ir para". */
export const ITENS_NAV: ItemNav[] = ENTRADAS_NAV.flatMap((e) => (ehGrupo(e) ? e.itens : [e]));
