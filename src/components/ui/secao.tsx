import { CaretDown } from "@phosphor-icons/react/ssr";

/**
 * Seção recolhível do painel de detalhe: registros com muita informação (cliente com guias, notas, documentos)
 * não viram uma parede única. Usa <details>, então teclado e leitor de tela funcionam sem código extra.
 */
export function Secao({
  titulo,
  aberta = true,
  resumo,
  children,
}: {
  titulo: string;
  aberta?: boolean;
  /** Texto curto à direita do título, visível mesmo recolhida (ex.: "3 em aberto"). */
  resumo?: string;
  children: React.ReactNode;
}) {
  return (
    <details open={aberta} className="group border-t border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className="font-display text-base font-semibold">{titulo}</span>
        <span className="flex items-center gap-2 text-[13px] text-muted">
          {resumo}
          <CaretDown size={16} weight="bold" className="transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}
