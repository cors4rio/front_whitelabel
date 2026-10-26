"use client";

import { CaretLeft, CaretRight, MagnifyingGlass, UsersThree } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { Carregando } from "@/components/ui/spinner";
import { formatarDocumento } from "@/lib/documento";
import { numero } from "@/lib/format";
import { FILTROS_PERFIS_PADRAO, TAMANHO_PAGINA_PERFIS, usePerfis, type FiltrosPerfis } from "@/lib/notas/queries";
import { ROTULO_CANAL_CURTO } from "@/lib/notas/regras";
import type { FiltroPerfil, PerfilFiscalResumo } from "@/lib/types";

interface Props {
  filtros: FiltrosPerfis;
  onFiltros: (filtros: FiltrosPerfis) => void;
  selecionadoId: number | null;
  hrefCliente: (id: number) => string;
}

const OPCOES: { valor: FiltroPerfil; rotulo: string }[] = [
  { valor: "TODOS", rotulo: "Todos os clientes" },
  { valor: "PRONTOS", rotulo: "Prontos para emitir" },
  { valor: "PENDENTES", rotulo: "Com pendências" },
  { valor: "NAO_CONFIGURADOS", rotulo: "Sem dados fiscais" },
];

function situacaoDe(p: PerfilFiscalResumo): { tom: "ok" | "atencao" | "neutro"; rotulo: string } {
  if (!p.configurado) return { tom: "neutro", rotulo: "Sem dados fiscais" };
  return p.pronta ? { tom: "ok", rotulo: "Pronto" } : { tom: "atencao", rotulo: "Pendente" };
}

/** Os clientes ativos e a situação fiscal de cada um: é daqui que se escolhe de quem configurar os dados. */
export function PerfisLista({ filtros, onFiltros, selecionadoId, hrefCliente }: Props) {
  // A busca é local e só vira filtro (URL) depois de uma pausa na digitação (mesmo padrão das outras listas).
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

  const { data, isPending, isError, isFetching, refetch } = usePerfis(filtros);
  const temFiltro = Boolean(filtros.busca || filtros.situacao !== FILTROS_PERFIS_PADRAO.situacao);
  const inicio = data ? data.page * data.size + 1 : 0;
  const fim = data ? data.page * data.size + data.content.length : 0;

  return (
    <div className="rounded-ui border border-line bg-paper">
      <div className="flex flex-col gap-2 border-b border-line p-3">
        <div className="relative">
          <MagnifyingGlass size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <Input type="search" aria-label="Buscar cliente por nome ou CPF/CNPJ" placeholder="Buscar cliente" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select aria-label="Filtrar por situação fiscal" value={filtros.situacao} onChange={(e) => onFiltros({ ...filtros, situacao: e.target.value as FiltroPerfil, pagina: 0 })}>
          {OPCOES.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </Select>
      </div>

      {isPending && (
        <div className="p-6">
          <Carregando texto="Carregando clientes…" />
        </div>
      )}

      {isError && (
        <div className="p-6">
          <p className="text-crimson">Não foi possível carregar os clientes.</p>
          <Button className="mt-3" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {data && data.content.length === 0 && (
        <EmptyState
          icone={<UsersThree size={40} weight="duotone" aria-hidden />}
          titulo={temFiltro ? "Nenhum cliente encontrado" : "Nenhum cliente ativo"}
          texto={temFiltro ? "Nenhum cliente corresponde à busca ou ao filtro escolhido." : "Cadastre um cliente para configurar os dados fiscais dele."}
        >
          {temFiltro ? (
            <Button
              onClick={() => {
                setBusca("");
                onFiltros(FILTROS_PERFIS_PADRAO);
              }}
            >
              Limpar filtros
            </Button>
          ) : (
            <Link href="/clientes" className="text-accent-text hover:underline">
              Ir para Clientes
            </Link>
          )}
        </EmptyState>
      )}

      {data && data.content.length > 0 && (
        <ul className={`p-1.5 ${isFetching ? "opacity-70" : ""}`}>
          {data.content.map((p) => {
            const selecionado = p.clienteId === selecionadoId;
            const situacao = situacaoDe(p);
            return (
              <li key={p.clienteId}>
                <Link
                  href={hrefCliente(p.clienteId)}
                  aria-current={selecionado ? "true" : undefined}
                  className={`flex flex-col gap-0.5 rounded-ui px-3 py-2.5 ${selecionado ? "bg-line/40" : "hover:bg-line/25"}`}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-semibold">{p.clienteNome}</span>
                    <Pill tom={situacao.tom}>{situacao.rotulo}</Pill>
                  </span>
                  <span className="truncate text-[13px] tabular-nums text-muted">
                    {formatarDocumento(p.clienteDocumento)}
                    {p.configurado && p.municipioNome && ` · ${p.municipioNome}/${p.uf}`}
                    {p.configurado && ` · ${ROTULO_CANAL_CURTO[p.canal].toLowerCase()}`}
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
          {data.totalElements > TAMANHO_PAGINA_PERFIS && (
            <div className="flex gap-1">
              <Button pequeno aria-label="Página anterior" disabled={data.page === 0} onClick={() => onFiltros({ ...filtros, pagina: filtros.pagina - 1 })}>
                <CaretLeft size={14} weight="bold" aria-hidden />
              </Button>
              <Button pequeno aria-label="Próxima página" disabled={data.page + 1 >= data.totalPages} onClick={() => onFiltros({ ...filtros, pagina: filtros.pagina + 1 })}>
                <CaretRight size={14} weight="bold" aria-hidden />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
