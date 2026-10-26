"use client";

import { Plus } from "@phosphor-icons/react";
import Link from "next/link";

import { StatusDaNota } from "@/components/notas/status-da-nota";
import { classesBotao } from "@/components/ui/button";
import { Secao } from "@/components/ui/secao";
import { Carregando } from "@/components/ui/spinner";
import { moeda, numero } from "@/lib/format";
import { useNotasDoCliente } from "@/lib/notas/queries";
import { dataDaLinha } from "@/lib/notas/regras";

/**
 * As últimas notas fiscais do cliente, dentro do painel de detalhe dele (spec de design: seção colapsável com os
 * registros ligados ao cliente). É um atalho: a lista completa fica em Notas fiscais.
 */
export function NotasDoCliente({ clienteId }: { clienteId: number }) {
  const { data, isPending, isError } = useNotasDoCliente(clienteId);
  const total = data?.totalElements ?? 0;
  const resumo = isPending || isError ? undefined : total === 0 ? "Nenhuma nota" : `${numero(total)} ${total === 1 ? "nota" : "notas"}`;

  return (
    <Secao titulo="Notas fiscais" resumo={resumo}>
      {isPending && <Carregando texto="Carregando notas…" />}
      {isError && <p className="text-crimson">Não foi possível carregar as notas fiscais deste cliente.</p>}

      {data && data.content.length === 0 && <p className="text-muted">Nenhuma nota fiscal emitida para este cliente.</p>}

      {data && data.content.length > 0 && (
        <ul className="-mx-1.5">
          {data.content.map((n) => (
            <li key={n.id}>
              <Link href={`/notas-fiscais?id=${n.id}`} className="flex items-center justify-between gap-3 rounded-ui px-1.5 py-2 hover:bg-line/25">
                <span className="min-w-0">
                  <span className="block truncate font-medium tabular-nums">{moeda(n.valor)}</span>
                  <span className="block truncate text-[13px] tabular-nums text-muted">
                    {dataDaLinha(n)}
                    {n.numero && ` · Nº ${n.numero}`}
                  </span>
                </span>
                <StatusDaNota status={n.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data && total > data.content.length && (
        <p className="mt-1 text-[13px] text-muted">e mais {numero(total - data.content.length)} {total - data.content.length === 1 ? "nota" : "notas"}.</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/notas-fiscais?novo=1&clienteId=${clienteId}`} className={classesBotao("secundario", true)}>
          <Plus size={14} weight="bold" aria-hidden />
          Emitir nota
        </Link>
        <Link href={`/notas-fiscais?clienteId=${clienteId}`} className={classesBotao("fantasma", true)}>
          Ver todas as notas
        </Link>
        <Link href={`/notas-fiscais/configuracao?cliente=${clienteId}`} className={classesBotao("fantasma", true)}>
          Dados fiscais
        </Link>
      </div>
    </Secao>
  );
}
