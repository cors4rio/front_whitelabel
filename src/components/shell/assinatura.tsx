/**
 * Assinatura de propriedade "Desenvolvido por AUTTOPUS" (docs/ui-ux.md, seção 13).
 * É a única exceção em que a identidade da Auttopus (Oswald, caixa alta, "O" em laranja #FD8916) aparece
 * dentro do produto: pequena, no rodapé, sem competir com a marca do produto. Não aparece no login.
 */
export function Assinatura({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-baseline gap-1.5 text-xs text-muted ${className}`}>
      <span>Desenvolvido por</span>
      <span className="font-brand text-[13px] font-semibold uppercase tracking-wide text-fg" aria-label="Auttopus">
        AUTT<span className="text-[#fd8916]">O</span>PUS
      </span>
    </p>
  );
}
