"use client";

import { X } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  largura?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const LARGURAS = { sm: "max-w-[420px]", md: "max-w-[560px]", lg: "max-w-[720px]" };

/**
 * Modal sobre <dialog> nativo: foco preso, Esc e role já corretos de graça. Reservado para confirmação
 * destrutiva curta e tarefas pontuais (importar CSV) — registros são vistos/editados no painel de detalhe.
 */
export function Modal({ aberto, onFechar, titulo, largura = "md", children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (aberto && !dialog.open) {
      dialog.showModal();
      // O padrão do navegador foca o primeiro controle (o "X"). Foca-se o campo/ação pensado para começar.
      (dialog.querySelector<HTMLElement>("[data-autofocus]") ?? dialog).focus({ preventScroll: true });
    }
    if (!aberto && dialog.open) dialog.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      onClose={onFechar}
      onClick={(e) => {
        if (e.target === ref.current) onFechar();
      }}
      aria-labelledby="modal-titulo"
      tabIndex={-1}
      className={`m-auto w-[min(92vw,100%)] ${LARGURAS[largura]} rounded-ui border border-line bg-paper p-0 text-fg outline-none shadow-[0_8px_24px_rgba(36,28,26,0.12)]`}
    >
      {aberto && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 id="modal-titulo" className="font-display text-xl font-semibold">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="grid size-8 place-items-center rounded-ui text-muted hover:bg-line/40"
            >
              <X size={18} weight="bold" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
