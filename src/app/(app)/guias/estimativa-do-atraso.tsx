"use client";

import Link from "next/link";
import { useState } from "react";

import { Field, Input } from "@/components/ui/field";
import { Carregando } from "@/components/ui/spinner";
import { hojeNoEscritorio, moeda } from "@/lib/format";
import { rotuloDoMes } from "@/lib/notas/regras";
import { useEstimativaDaGuia } from "@/lib/queries-guias";
import type { Guia } from "@/lib/types";

const percentual = (valor: number | null) => (valor === null ? "—" : `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);

/**
 * Quanto custaria pagar uma guia vencida numa data: multa de 0,33% ao dia (no máximo 20%) e juros pela Selic acumulada mais 1% nas
 * guias federais. É sempre uma ESTIMATIVA: a guia nova sai do sistema oficial (SicalcWeb, PGDAS-D, DCTFWeb, FGTS Digital...) com o
 * valor dele. FGTS, ISS e outras não têm fórmula aqui e dizem onde ver o valor certo.
 */
export function EstimativaDoAtraso({ guia }: { guia: Guia }) {
  const hoje = hojeNoEscritorio();
  const [pagamento, setPagamento] = useState(hoje);
  const dataValida = pagamento >= hoje;
  const { data, isPending, isError } = useEstimativaDaGuia(guia.id, pagamento, dataValida);

  return (
    <div>
      <div className="max-w-xs">
        <Field rotulo="Se pagar em" erro={dataValida ? undefined : "Escolha hoje ou uma data futura"}>
          {(a) => <Input {...a} type="date" min={hoje} value={pagamento} onChange={(e) => setPagamento(e.target.value)} />}
        </Field>
      </div>

      <div aria-live="polite" className="mt-3">
        {dataValida && isPending && <Carregando texto="Calculando…" />}
        {dataValida && isError && <p className="text-crimson">Não foi possível calcular agora. Tente de novo.</p>}

        {data && !data.estimavel && (
          <p role="note" className="rounded-ui border border-line px-3.5 py-3 text-muted">
            {data.motivo}
          </p>
        )}

        {data && data.estimavel && (
          <section aria-label="Estimativa do atraso">
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1.5">
              <dt className="text-muted">Valor da guia</dt>
              <dd className="text-right tabular-nums">{moeda(data.principal)}</dd>
              <dt className="text-muted">
                Multa ({percentual(data.multaPercentual)} · {data.diasDeAtraso} {data.diasDeAtraso === 1 ? "dia" : "dias"} de atraso)
              </dt>
              <dd className="text-right tabular-nums">{data.multa === null ? "—" : moeda(data.multa)}</dd>
              <dt className="text-muted">Juros ({percentual(data.jurosPercentual)})</dt>
              <dd className="text-right tabular-nums">{data.juros === null ? "—" : moeda(data.juros)}</dd>
              <dt className="border-t border-line pt-1.5 font-semibold">Total estimado</dt>
              <dd className="border-t border-line pt-1.5 text-right font-display text-xl font-bold tabular-nums">{data.total === null ? "—" : moeda(data.total)}</dd>
            </dl>
            {data.mesesSemSelic.length > 0 && (
              <p role="alert" className="mt-3 rounded-ui border border-amber/70 bg-amber/10 px-3 py-2 text-[13px]">
                <strong>Faltam os juros:</strong> a tabela não tem a Selic de {data.mesesSemSelic.map(rotuloDoMes).join(", ")}. Um administrador pode digitá-la ou buscá-la
                no Banco Central em{" "}
                <Link href="/financeiro#selic" className="font-semibold text-accent-text hover:underline">
                  Financeiro
                </Link>
                .
              </p>
            )}
          </section>
        )}

        {data && <p className="mt-3 text-[13px] text-muted">{data.aviso}</p>}
      </div>
    </div>
  );
}
