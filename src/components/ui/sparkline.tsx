/**
 * Mini gráfico inline (spec de design, "sparkline embutido"): fica ao lado do próprio número, como conteúdo da
 * linha, e não num cartão isolado. Sem eixo nem grade; é um indicador de formato, o valor exato está no texto.
 * São barras porque o dado é contagem por dia (discreto). Dia sem nada vira um traço fino, para a escala
 * continuar legível.
 */
export function Sparkline({ valores, rotulo, className = "" }: { valores: number[]; rotulo: string; className?: string }) {
  const largura = 64;
  const altura = 24;
  const folga = 3;
  const n = Math.max(valores.length, 1);
  const larguraBarra = (largura - folga * (n - 1)) / n;
  const maximo = Math.max(1, ...valores);

  return (
    <svg
      viewBox={`0 0 ${largura} ${altura}`}
      width={largura}
      height={altura}
      role="img"
      aria-label={rotulo}
      className={`shrink-0 text-accent ${className}`}
    >
      {valores.map((v, i) => {
        const h = v === 0 ? 1.5 : Math.max(3, (v / maximo) * altura);
        return (
          <rect
            key={i}
            x={i * (larguraBarra + folga)}
            y={altura - h}
            width={larguraBarra}
            height={h}
            rx={1}
            fill="currentColor"
            opacity={v === 0 ? 0.3 : 1}
          />
        );
      })}
    </svg>
  );
}
