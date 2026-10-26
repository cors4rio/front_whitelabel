"use client";

import { ArrowRight, UploadSimple, UserPlus, UsersThree, Warning, WarningOctagon } from "@phosphor-icons/react";
import Link from "next/link";

import { Button, classesBotao } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkline } from "@/components/ui/sparkline";
import { Carregando } from "@/components/ui/spinner";
import { moedaInteira, numero } from "@/lib/format";
import { NOTAS_FISCAIS_ATIVAS } from "@/lib/notas/modo";
import { rotuloDoMes } from "@/lib/notas/regras";
import { useResumo } from "@/lib/queries";
import type { ResumoPainel } from "@/lib/types";

type Tom = "atencao" | "problema";

interface Alerta {
  id: string;
  tom: Tom;
  texto: string;
  href: string;
}

/** Do mais grave para o menos grave: o que já venceu vem antes do que está para vencer. */
function alertasDe(d: ResumoPainel): Alerta[] {
  const alertas: Alerta[] = [];
  if (d.guiasVencidas > 0) {
    alertas.push({
      id: "vencidas",
      tom: "problema",
      texto: d.guiasVencidas === 1 ? "1 guia vencida e ainda não paga." : `${numero(d.guiasVencidas)} guias vencidas e ainda não pagas.`,
      href: "/guias?situacao=VENCIDA",
    });
  }
  if (d.guiasVencendo > 0) {
    alertas.push({
      id: "vencendo",
      tom: "atencao",
      texto: d.guiasVencendo === 1 ? "1 guia vence nos próximos 7 dias." : `${numero(d.guiasVencendo)} guias vencem nos próximos 7 dias.`,
      href: "/guias?situacao=VENCENDO",
    });
  }
  if (d.clientesAtivosSemPlano > 0) {
    alertas.push({
      id: "sem-plano",
      tom: "atencao",
      texto:
        d.clientesAtivosSemPlano === 1
          ? "1 cliente ativo está sem plano e não entra na receita prevista."
          : `${numero(d.clientesAtivosSemPlano)} clientes ativos estão sem plano e não entram na receita prevista.`,
      href: "/clientes?status=ATIVO&semPlano=true",
    });
  }
  return alertas;
}

/**
 * Painel com hierarquia assimétrica (docs/ui-ux.md, seção 7): um número
 * dominante e as demais métricas subordinadas — não uma fileira de quatro cartões iguais. O gráfico das guias
 * fica embutido na própria linha, ao lado do número. Mostra só o que os módulos prontos sabem responder; notas
 * do mês e tarefas atrasadas entram com os seus módulos.
 */
export function PainelView() {
  const { data, isPending, isError, refetch } = useResumo();
  const alertas = data ? alertasDe(data) : [];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-[25px] font-semibold sm:text-[32px]">Painel</h1>

      {isPending && (
        <div className="mt-8">
          <Carregando texto="Carregando o resumo…" />
        </div>
      )}

      {isError && (
        <div className="mt-8 rounded-ui border border-crimson/40 p-4">
          <p className="text-crimson">Não foi possível carregar o resumo do painel.</p>
          <Button className="mt-3" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {data && data.clientesAtivos + data.clientesInativos === 0 && (
        <div className="mt-8 rounded-ui border border-line bg-paper">
          <EmptyState
            icone={<UsersThree size={40} weight="duotone" aria-hidden />}
            titulo="Cadastre o primeiro cliente"
            texto="O painel passa a mostrar a receita prevista e as pendências assim que houver clientes cadastrados."
          >
            <Link href="/clientes?novo=1" className={classesBotao("primario")}>
              <UserPlus size={18} weight="bold" aria-hidden />
              Novo cliente
            </Link>
            <Link href="/clientes?importar=1" className={classesBotao()}>
              <UploadSimple size={18} weight="bold" aria-hidden />
              Importar CSV
            </Link>
          </EmptyState>
        </div>
      )}

      {data && data.clientesAtivos + data.clientesInativos > 0 && (
        <>
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section className="flex flex-col justify-between gap-8 rounded-ui border border-line bg-paper p-6 sm:p-8">
              <div>
                <p className="text-muted">Receita mensal prevista</p>
                <p className="mt-2 font-display text-[clamp(44px,9vw,64px)] font-bold leading-none tabular-nums">
                  {moedaInteira(data.receitaMensalPrevista)}
                </p>
                <p className="mt-3 text-muted">
                  Soma dos planos dos clientes ativos
                  {data.clientesAtivosSemPlano > 0 ? ` (${numero(data.clientesAtivosSemPlano)} ainda sem plano)` : ""}.
                </p>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Link href="/clientes" className="inline-flex items-center gap-1.5 font-semibold text-accent-text hover:underline">
                  Ver clientes
                  <ArrowRight size={16} weight="bold" aria-hidden />
                </Link>
                <Link href="/financeiro" className="inline-flex items-center gap-1.5 font-semibold text-accent-text hover:underline">
                  Ver o financeiro
                  <ArrowRight size={16} weight="bold" aria-hidden />
                </Link>
              </div>
            </section>

            <section aria-label="Resumo" className="divide-y divide-line rounded-ui border border-line bg-paper">
              <Linha
                rotulo="Guias vencendo (7 dias)"
                valor={numero(data.guiasVencendo)}
                tom={data.guiasVencendo > 0 ? "atencao" : undefined}
                extra={
                  <Sparkline
                    valores={data.vencimentosProximos}
                    rotulo={`Guias pendentes por dia de vencimento, de hoje até daqui a 7 dias: ${data.vencimentosProximos.join(", ")}`}
                  />
                }
              />
              <Linha rotulo="Guias vencidas" valor={numero(data.guiasVencidas)} tom={data.guiasVencidas > 0 ? "problema" : undefined} />
              <Linha rotulo="Guias em aberto (valor)" valor={moedaInteira(data.valorGuiasEmAberto)} />
              {NOTAS_FISCAIS_ATIVAS && data.emitidoMesAnterior !== null && (
                <Linha rotulo={`Emitido em ${rotuloDoMes(data.mesAnterior)}`} valor={moedaInteira(data.emitidoMesAnterior)} />
              )}
              <Linha rotulo="Clientes ativos" valor={numero(data.clientesAtivos)} />
              <Linha rotulo="Clientes inativos" valor={numero(data.clientesInativos)} />
            </section>
          </div>

          <section aria-labelledby="pendencias" className="mt-4 rounded-ui border border-line bg-paper">
            <h2 id="pendencias" className="border-b border-line px-5 py-3 font-display text-lg font-semibold">
              Alertas e pendências
            </h2>
            {alertas.length > 0 ? (
              <ul className="divide-y divide-line">
                {alertas.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
                    {a.tom === "problema" ? (
                      <WarningOctagon size={18} weight="bold" className="shrink-0 text-crimson" aria-hidden />
                    ) : (
                      <Warning size={18} weight="bold" className="shrink-0 text-amber-ink" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">{a.texto}</span>
                    <Link href={a.href} className="font-semibold text-accent-text hover:underline">
                      Ver quais
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-muted">Nenhuma pendência no momento.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

const COR_DO_TOM: Record<Tom, string> = { atencao: "text-amber-ink", problema: "text-crimson" };

function Linha({
  rotulo,
  valor,
  tom,
  extra,
}: {
  rotulo: string;
  valor: string;
  tom?: Tom;
  /** Conteúdo embutido ao lado do número (ex.: o gráfico), não um cartão separado. */
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <span className="text-muted">{rotulo}</span>
      <span className="flex items-center gap-3">
        {extra}
        <span className={`font-display text-[28px] font-bold leading-none tabular-nums ${tom ? COR_DO_TOM[tom] : ""}`}>
          {valor}
        </span>
      </span>
    </div>
  );
}
