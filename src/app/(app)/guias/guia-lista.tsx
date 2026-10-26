"use client";

import { Barcode, CaretLeft, CaretRight, MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, classesBotao } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { Carregando } from "@/components/ui/spinner";
import { dataBR, moeda, numero } from "@/lib/format";
import { classeDaData, complementoVencimento, ROTULO_SITUACAO, situacaoDaGuia, TOM_SITUACAO } from "@/lib/guias";
import { useCliente } from "@/lib/queries";
import { FILTROS_GUIAS_PADRAO, TAMANHO_PAGINA_GUIAS, useGuias, type FiltrosGuias } from "@/lib/queries-guias";
import type { FiltroSituacao } from "@/lib/types";

interface Props {
  filtros: FiltrosGuias;
  onFiltros: (filtros: FiltrosGuias) => void;
  selecionadaId: number | null;
  hrefGuia: (id: number) => string;
  hrefNova: string;
}

const OPCOES_SITUACAO: { valor: FiltroSituacao; rotulo: string }[] = [
  { valor: "EM_ABERTO", rotulo: "Em aberto" },
  { valor: "VENCIDA", rotulo: "Vencidas" },
  { valor: "VENCENDO", rotulo: "Vencendo em 7 dias" },
  { valor: "PAGA", rotulo: "Pagas" },
  { valor: "CANCELADA", rotulo: "Canceladas" },
  { valor: "TODAS", rotulo: "Todas" },
];

export function GuiaLista({ filtros, onFiltros, selecionadaId, hrefGuia, hrefNova }: Props) {
  // A busca é local e só vira filtro (URL) depois de uma pausa na digitação; quando a URL muda por fora, o campo
  // acompanha (ajuste de estado derivado durante a renderização). Mesmo padrão da lista de clientes.
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

  const { data, isPending, isError, isFetching, refetch } = useGuias(filtros);
  const { data: clienteDoFiltro } = useCliente(filtros.clienteId ? Number(filtros.clienteId) : null);

  const temFiltroAlemDoPadrao = Boolean(filtros.busca || filtros.clienteId || filtros.situacao !== FILTROS_GUIAS_PADRAO.situacao);
  const inicio = data ? data.page * data.size + 1 : 0;
  const fim = data ? data.page * data.size + data.content.length : 0;

  return (
    <div className="rounded-ui border border-line bg-paper">
      <div className="flex flex-col gap-2 border-b border-line p-3">
        <div className="relative">
          <MagnifyingGlass size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            type="search"
            aria-label="Buscar por descrição, cliente ou CPF/CNPJ"
            placeholder="Buscar guia, cliente ou CPF/CNPJ"
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select
          aria-label="Filtrar por situação"
          value={filtros.situacao}
          onChange={(e) => onFiltros({ ...filtros, situacao: e.target.value as FiltroSituacao, pagina: 0 })}
        >
          {OPCOES_SITUACAO.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </Select>
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
          <Carregando texto="Carregando guias…" />
        </div>
      )}

      {isError && (
        <div className="p-6">
          <p className="text-crimson">Não foi possível carregar as guias.</p>
          <Button className="mt-3" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {data && data.content.length === 0 && (
        temFiltroAlemDoPadrao ? (
          <EmptyState
            icone={<MagnifyingGlass size={40} weight="duotone" aria-hidden />}
            titulo="Nenhuma guia encontrada"
            texto="Nenhuma guia corresponde à busca ou aos filtros escolhidos."
          >
            <Button
              onClick={() => {
                setBusca("");
                onFiltros({ ...FILTROS_GUIAS_PADRAO, situacao: "TODAS" });
              }}
            >
              Ver todas as guias
            </Button>
          </EmptyState>
        ) : (
          <EmptyState
            icone={<Barcode size={40} weight="duotone" aria-hidden />}
            titulo="Nenhuma guia em aberto"
            texto="Tudo em dia, ou ainda não há guias cadastradas. As pagas e as canceladas ficam em “Todas”."
          >
            <Link href={hrefNova} className={classesBotao()}>
              <Plus size={18} weight="bold" aria-hidden />
              Nova guia
            </Link>
            <Button onClick={() => onFiltros({ ...filtros, situacao: "TODAS", pagina: 0 })}>Ver todas</Button>
          </EmptyState>
        )
      )}

      {data && data.content.length > 0 && (
        <ul className={`p-1.5 ${isFetching ? "opacity-70" : ""}`}>
          {data.content.map((g) => {
            const selecionada = g.id === selecionadaId;
            const situacao = situacaoDaGuia(g);
            const complemento = complementoVencimento(g);
            return (
              <li key={g.id}>
                <Link
                  href={hrefGuia(g.id)}
                  aria-current={selecionada ? "true" : undefined}
                  className={`flex flex-col gap-0.5 rounded-ui px-3 py-2.5 ${selecionada ? "bg-line/40" : "hover:bg-line/25"}`}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-semibold">{g.descricao}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{moeda(g.valor)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-3 text-[13px]">
                    {/* A data vem primeiro: se faltar espaço quem trunca é o nome do cliente, não a urgência. */}
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span className={`shrink-0 whitespace-nowrap font-medium tabular-nums ${classeDaData(g)}`}>
                        {dataBR(g.vencimento)}
                        {complemento && ` · ${complemento}`}
                      </span>
                      <span className="truncate text-muted">· {g.clienteNome}</span>
                    </span>
                    <Pill tom={TOM_SITUACAO[situacao]}>{ROTULO_SITUACAO[situacao]}</Pill>
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
          {data.totalElements > TAMANHO_PAGINA_GUIAS && (
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
