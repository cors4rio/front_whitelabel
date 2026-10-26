import { VERSAO_DO_BANCO, type Banco } from "./banco.ts";

/** Onde a simulação guarda o estado entre uma chamada e outra. */
export interface Armazenamento {
  ler(): Banco | null;
  gravar(banco: Banco): void;
  limpar(): void;
}

/** Guarda o JSON (e não o objeto): quem lê recebe sempre uma cópia, como receberia de um servidor de verdade. */
export function armazenamentoEmMemoria(): Armazenamento {
  let texto: string | null = null;
  return {
    ler: () => lerBanco(texto),
    gravar: (banco) => {
      texto = JSON.stringify(banco);
    },
    limpar: () => {
      texto = null;
    },
  };
}

function lerBanco(texto: string | null): Banco | null {
  if (!texto) return null;
  try {
    const banco = JSON.parse(texto) as Banco;
    return banco.versao === VERSAO_DO_BANCO ? banco : null;
  } catch {
    return null;
  }
}

const CHAVE_DO_BANCO = "demo-notas-fiscais:v1";
const CHAVE_DO_ATRASO = "demo-notas:atraso";

/**
 * localStorage: a simulação sobrevive a recarregar a página e é compartilhada entre abas. Se o navegador não
 * deixar usá-lo (janela privativa, dados bloqueados), cai para a memória e perde o estado ao recarregar.
 */
export function armazenamentoDoNavegador(): Armazenamento {
  const reserva = armazenamentoEmMemoria();
  const disponivel = (() => {
    try {
      localStorage.setItem(`${CHAVE_DO_BANCO}:teste`, "1");
      localStorage.removeItem(`${CHAVE_DO_BANCO}:teste`);
      return true;
    } catch {
      return false;
    }
  })();
  if (!disponivel) return reserva;

  return {
    ler: () => lerBanco(localStorage.getItem(CHAVE_DO_BANCO)),
    gravar: (banco) => localStorage.setItem(CHAVE_DO_BANCO, JSON.stringify(banco)),
    limpar: () => localStorage.removeItem(CHAVE_DO_BANCO),
  };
}

export const ATRASO_PADRAO_MS = 2500;

/** Tempo que a nota enviada leva para ser autorizada ou rejeitada. Os testes encurtam gravando {@link CHAVE_DO_ATRASO}. */
export function atrasoDoNavegador(): number {
  try {
    const gravado = Number(localStorage.getItem(CHAVE_DO_ATRASO));
    return Number.isFinite(gravado) && gravado >= 0 && localStorage.getItem(CHAVE_DO_ATRASO) !== null ? Math.min(gravado, 60_000) : ATRASO_PADRAO_MS;
  } catch {
    return ATRASO_PADRAO_MS;
  }
}
