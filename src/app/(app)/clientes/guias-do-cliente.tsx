"use client";

import { Plus } from "@phosphor-icons/react";
import Link from "next/link";

import { classesBotao } from "@/components/ui/button";
import { Secao } from "@/components/ui/secao";
import { Carregando } from "@/components/ui/spinner";
import { dataBR, moeda, numero } from "@/lib/format";
import { classeDaData, complementoVencimento } from "@/lib/guias";
import { useGuiasEmAbertoDoCliente } from "@/lib/queries-guias";

/**
 * As guias em aberto do cliente, as mais urgentes primeiro, dentro do painel de detalhe dele (spec de design:
 * seção colapsável com os registros ligados ao cliente). É um atalho: a lista completa fica em Guias.
 */
export function GuiasDoCliente({ clienteId }: { clienteId: number }) {
  const { data, isPending, isError } = useGuiasEmAbertoDoCliente(clienteId);
  const total = data?.totalElements ?? 0;
  const resumo = isPending || isError ? undefined : total === 0 ? "Nenhuma em aberto" : `${numero(total)} em aberto`;

  return (
    <Secao titulo="Guias" resumo={resumo}>
      {isPending && <Carregando texto="Carregando guias…" />}
      {isError && <p className="text-crimson">Não foi possível carregar as guias deste cliente.</p>}

      {data && data.content.length === 0 && <p className="text-muted">Nenhuma guia em aberto para este cliente.</p>}

      {data && data.content.length > 0 && (
        <ul className="-mx-1.5">
          {data.content.map((g) => {
            const complemento = complementoVencimento(g);
            return (
              <li key={g.id}>
                <Link
                  href={`/guias?id=${g.id}`}
                  className="flex items-baseline justify-between gap-3 rounded-ui px-1.5 py-2 hover:bg-line/25"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{g.descricao}</span>
                    <span className={`block text-[13px] tabular-nums ${classeDaData(g)}`}>
                      {dataBR(g.vencimento)}
                      {complemento && ` · ${complemento}`}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{moeda(g.valor)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {data && total > data.content.length && (
        <p className="mt-1 text-[13px] text-muted">e mais {numero(total - data.content.length)} em aberto.</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/guias?novo=1&clienteId=${clienteId}`} className={classesBotao("secundario", true)}>
          <Plus size={14} weight="bold" aria-hidden />
          Nova guia
        </Link>
        <Link href={`/guias?clienteId=${clienteId}&situacao=TODAS`} className={classesBotao("fantasma", true)}>
          Ver todas as guias
        </Link>
      </div>
    </Secao>
  );
}
