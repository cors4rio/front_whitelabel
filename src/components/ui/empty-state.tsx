/** Todo estado vazio orienta: o que é isto, por que está vazio e qual o próximo passo (CTA). */
export function EmptyState({
  icone,
  titulo,
  texto,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  texto?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="text-muted">{icone}</div>
      <h3 className="font-display text-lg font-semibold">{titulo}</h3>
      {texto && <p className="max-w-sm text-muted">{texto}</p>}
      {children && <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
