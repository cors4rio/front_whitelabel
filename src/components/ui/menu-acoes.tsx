"use client";

import { DotsThree } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";

export interface ItemMenu {
  rotulo: string;
  aoSelecionar: () => void;
  perigo?: boolean;
}

/**
 * Menu "⋯" para as ações secundárias de um registro (o cabeçalho do painel mostra no máximo 2 botões e manda o
 * resto para cá). Padrão de menu WAI-ARIA: ↑↓ Home End percorrem, Esc fecha e devolve o foco ao botão, clicar
 * fora ou Tab fecham.
 */
export function MenuAcoes({ rotulo = "Mais ações", itens }: { rotulo?: string; itens: ItemMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const idMenu = useId();

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    raiz.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  if (itens.length === 0) return null;

  function aoTeclar(e: React.KeyboardEvent) {
    const elementos = Array.from(raiz.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const atual = elementos.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") elementos[(atual + 1) % elementos.length]?.focus();
    else if (e.key === "ArrowUp") elementos[(atual - 1 + elementos.length) % elementos.length]?.focus();
    else if (e.key === "Home") elementos[0]?.focus();
    else if (e.key === "End") elementos[elementos.length - 1]?.focus();
    else if (e.key === "Escape") {
      setAberto(false);
      botao.current?.focus();
    } else if (e.key === "Tab") {
      setAberto(false);
      return;
    } else return;
    e.preventDefault();
  }

  return (
    <div ref={raiz} className="relative">
      <button
        ref={botao}
        type="button"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
        onClick={() => setAberto((v) => !v)}
        className="grid size-10 place-items-center rounded-ui border border-line bg-paper hover:bg-line/40"
      >
        <DotsThree size={22} weight="bold" aria-hidden />
      </button>
      {aberto && (
        <div
          id={idMenu}
          role="menu"
          aria-label={rotulo}
          onKeyDown={aoTeclar}
          className="absolute right-0 top-full z-30 mt-1 min-w-52 rounded-ui border border-line bg-paper py-1 shadow-[0_8px_24px_rgba(36,28,26,0.12)]"
        >
          {itens.map((item) => (
            <button
              key={item.rotulo}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setAberto(false);
                botao.current?.focus();
                item.aoSelecionar();
              }}
              className={`block w-full px-3 py-2.5 text-left text-sm hover:bg-line/40 focus-visible:bg-line/40 ${
                item.perigo ? "text-crimson" : ""
              }`}
            >
              {item.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
