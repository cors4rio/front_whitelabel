"use client";

import { CaretLeft, CaretRight, FileText, MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { StatusDaNota } from "@/components/notas/status-da-nota";
import { Button, classesBotao } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { Carregando } from "@/components/ui/spinner";
import { hojeNoEscritorio, moeda, numero } from "@/lib/format";
import { dataDaLinha, mesesParaFiltro, notaDeTeste, OPCOES_STATUS } from "@/lib/notas/regras";
import { FILTROS_NOTAS_PADRAO, TAMANHO_PAGINA_NOTAS, useConfiguracaoFiscal, useNotas, type FiltrosNotas } from "@/lib/notas/queries";
import { useCliente } from "@/lib/queries";
import type { FiltroStatusNota } from "@/lib/types";

interface Props {
  filtros: FiltrosNotas;
  onFiltros: (filtros: FiltrosNotas) => void;
  selecionadaId: number | null;
  hrefNota: (id: number) => string;
  hrefNova: string;
}

export function NotaLista({ filtros, onFiltros, selecionadaId, hrefNota, hrefNova }: Props) {
  // A busca é local e só vira filtro (URL) depois de uma pausa na digitação; quando a URL muda por fora, o campo
  // acompanha (ajuste de estado derivado durante a renderização). Mesmo padrão da lista de guias.
  const [busca, setBusca] = useState(filtros.busca);
  const [buscaDaUrl, setBuscaDaUrl] = useState(filtros.busca);
  if (filtros.busca !== buscaDaUrl) {
    setBuscaDaUrl(filtros.busca);
    setBusca(filtros.busca);
  }
  useEffect(() => {
    const t = setTimeout(() => {
      if (busca !== filtros.busca) onFiltros({ ...filtros, busca, pagina: 0 });
    }, 300);
    return () => clearTimeout(t);
  }, [busca, filtros, onFiltros]);

  const { data, isPending, isError, isFetching, refetch } = useNotas(filtros);
  const { data: config } = useConfiguracaoFiscal();
  const { data: clienteDoFiltro } = useCliente(filtros.clienteId ? Number(filtros.clienteId) : null);
  const meses = useMemo(() => mesesParaFiltro(hojeNoEscritorio(), 12, filtros.mes), [filtros.mes]);

  const temFiltro = Boolean(
    filtros.busca || filtros.clienteId || filtros.mes || filtros.situacao !== FILTROS_NOTAS_PADRAO.situacao,
  );
  const inicio = data ? data.page * data.size + 1 : 0;
  const fim = data ? data.page * data.size + data.content.length : 0;

  return (
    <div className="rounded-ui border border-line bg-paper">
      <div className="flex flex-col gap-2 border-b border-line p-3">
        <div className="relative">
          <MagnifyingGlass size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            type="search"
            aria-label="Buscar por cliente, tomador, CPF/CNPJ, número ou descrição"
            placeholder="Buscar cliente, tomador ou número"
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select
            aria-label="Filtrar por situação"
            value={filtros.situacao}
            onChange={(e) => onFiltros({ ...filtros, situacao: e.target.value as FiltroStatusNota, pagina: 0 })}
          >
            {OPCOES_STATUS.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </Select>
          <Select aria-label="Filtrar por mês de competência" value={filtros.mes} onChange={(e) => onFiltros({ ...filtros, mes: e.target.value, pagina: 0 })}>
            <option value="">Todos os meses</option>
            {meses.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.rotulo}
              </option>
            ))}
          </Select>
        </div>
        {filtros.clienteId && (
          <p className="flex">
            <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-line py-0.5 pl-2.5 pr-1 text-[13px]">
              <span className="truncate">Cliente: {clienteDoFiltro?.nomeRazaoSocial ?? "…"}</span>
              <button
                type="button"
                aria-label="Remover filtro de cliente"
                onClick={() => onFiltros({ ...filtros, clienteId: "", pagina: 0 })}
                className="grid size-6 shrink-0 place-items-center rounded-full text-muted hover:bg-line/40"
              >
                <X size={14} weight="bold" aria-hidden />
              </button>
            </span>
          </p>
        )}
      </div>

      {isPending && (
        <div className="p-6">
          <Carregando texto="Carregando notas…" />
        </div>
      )}

      {isError && (
        <div className="p-6">
          <p className="text-crimson">Não foi possível carregar as notas fiscais.</p>
          <Button className="mt-3" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {data && data.content.length === 0 &&
        (temFiltro ? (
          <EmptyState
            icone={<MagnifyingGlass size={40} weight="duotone" aria-hidden />}
            titulo="Nenhuma nota encontrada"
            texto="Nenhuma nota corresponde à busca ou aos filtros escolhidos."
          >
            <Button
              onClick={() => {
                setBusca("");
                onFiltros(FILTROS_NOTAS_PADRAO);
              }}
            >
              Limpar filtros
            </Button>
          </EmptyState>
        ) : (
          <EmptyState
            icone={<FileText size={40} weight="duotone" aria-hidden />}
            titulo="Nenhuma nota fiscal ainda"
            texto="As notas de serviço que você emitir aparecem aqui, com a situação de cada uma."
          >
            <Link href={hrefNova} className={classesBotao()}>
              <Plus size={18} weight="bold" aria-hidden />
              Emitir nota
            </Link>
          </EmptyState>
        ))}

      {data && data.content.length > 0 && (
        <ul className={`p-1.5 ${isFetching ? "opacity-70" : ""}`}>
          {data.content.map((n) => {
            const selecionada = n.id === selecionadaId;
            return (
              <li key={n.id}>
                <Link
                  href={hrefNota(n.id)}
                  aria-current={selecionada ? "true" : undefined}
                  className={`flex flex-col gap-0.5 rounded-ui px-3 py-2.5 ${selecionada ? "bg-line/40" : "hover:bg-line/25"}`}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-semibold">{n.prestadorNome}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{moeda(n.valor)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-3 text-[13px] text-muted">
                    <span className="min-w-0 truncate tabular-nums">
                      para {n.tomadorNome} · {dataDaLinha(n)}
                      {n.numero && ` · Nº ${n.numero}`}
                      {config && notaDeTeste(n, config.ambiente) && " · teste"}
                      {n.canal === "MUNICIPAL_SALVADOR" && " · municipal"}
                    </span>
                    <StatusDaNota status={n.status} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.totalElements > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-[13px] text-muted">
          <span aria-live="polite">
            {numero(inicio)}–{numero(fim)} de {numero(data.totalElements)}
          </span>
          {data.totalElements > TAMANHO_PAGINA_NOTAS && (
            <div className="flex gap-1">
              <Button
                pequeno
                aria-label="Página anterior"
                disabled={data.page === 0}
                onClick={() => onFiltros({ ...filtros, pagina: filtros.pagina - 1 })}
              >
                <CaretLeft size={14} weight="bold" aria-hidden />
              </Button>
              <Button
                pequeno
                aria-label="Próxima página"
                disabled={data.page + 1 >= data.totalPages}
                onClick={() => onFiltros({ ...filtros, pagina: filtros.pagina + 1 })}
              >
                <CaretRight size={14} weight="bold" aria-hidden />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
