import { Spinner } from "./spinner";

type Variante = "primario" | "secundario" | "fantasma" | "perigo";

const VARIANTES: Record<Variante, string> = {
  // Texto escuro sobre coral: 4,6:1. Branco sobre coral reprovaria no contraste AA (3,7:1).
  primario: "bg-accent text-on-accent font-semibold hover:brightness-95 active:brightness-90",
  secundario: "border border-line bg-paper text-fg hover:bg-line/40",
  fantasma: "text-fg hover:bg-line/40",
  perigo: "border border-crimson/50 text-crimson hover:bg-crimson/10",
};

/** Classes de botão, para também estilizar <Link> como botão (sem aninhar <button> dentro de <a>). */
export function classesBotao(variante: Variante = "secundario", pequeno = false): string {
  return `inline-flex select-none items-center justify-center gap-2 rounded-ui font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
    pequeno ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm"
  } ${VARIANTES[variante]}`;
}

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  pequeno?: boolean;
  carregando?: boolean;
}

export function Button({
  variante = "secundario",
  pequeno = false,
  carregando = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...resto
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || carregando}
      className={`${classesBotao(variante, pequeno)} ${className}`}
      {...resto}
    >
      {carregando && <Spinner tamanho={16} />}
      {children}
    </button>
  );
}
