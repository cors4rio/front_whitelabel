"use client";

import { CaretLeft, CaretRight, MagnifyingGlass, UploadSimple, UserPlus, UsersThree } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, classesBotao } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { Carregando } from "@/components/ui/spinner";
import { formatarDocumento } from "@/lib/documento";
import { numero } from "@/lib/format";
import { FILTROS_VAZIOS, TAMANHO_PAGINA, useClientes, usePlanos, type FiltrosClientes } from "@/lib/queries";

interface Props {
  filtros: FiltrosClientes;
  onFiltros: (filtros: FiltrosClientes) => void;
  selecionadoId: number | null;
  hrefCliente: (id: number) => string;
  hrefNovo: string;
  hrefImportar: string;
}

export function ClienteLista({ filtros, onFiltros, selecionadoId, hrefCliente, hrefNovo, hrefImportar }: Props) {
  // O campo de busca é local e só vira filtro (URL) depois de uma pausa na digitação: sem uma requisição por
  // tecla. Quando a URL muda por fora (outro link, "limpar filtros"), o campo acompanha — ajuste de estado
  // derivado durante a renderização, o padrão recomendado do React.
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

  const { data, isPending, isError, isFetching, refetch } = useClientes(filtros);
  const { data: planos } = usePlanos();

  const temFiltro = Boolean(filtros.busca || filtros.status || filtros.planoId || filtros.semPlano);
  const inicio = data ? data.page * data.size + 1 : 0;
  const fim = data ? data.page * data.size + data.content.length : 0;

  return (
    <div className="rounded-ui border border-line bg-paper">
      <div className="flex flex-col gap-2 border-b border-line p-3">
        <div className="relative">
          <MagnifyingGlass size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            type="search"
            aria-label="Buscar por nome, CPF/CNPJ ou e-mail"
            placeholder="Buscar por nome, CPF/CNPJ ou e-mail"
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select
            aria-label="Filtrar por status"
            value={filtros.status}
            onChange={(e) => onFiltros({ ...filtros, status: e.target.value as FiltrosClientes["status"], pagina: 0 })}
          >
            <option value="">Todos os status</option>
            <option value="ATIVO">Ativos</option>
            <option value="INATIVO">Inativos</option>
          </Select>
          <Select
            aria-label="Filtrar por plano"
            value={filtros.semPlano ? "sem" : filtros.planoId}
            onChange={(e) => {
              const v = e.target.value;
              onFiltros({ ...filtros, planoId: v === "sem" ? "" : v, semPlano: v === "sem", pagina: 0 });
            }}
          >
            <option value="">Todos os planos</option>
            <option value="sem">Sem plano</option>
            {planos?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
        </div>
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
        temFiltro ? (
          <EmptyState
            icone={<MagnifyingGlass size={40} weight="duotone" aria-hidden />}
            titulo="Nenhum cliente encontrado"
            texto="Nenhum cliente corresponde à busca ou aos filtros escolhidos."
          >
            <Button
              onClick={() => {
                setBusca("");
                onFiltros(FILTROS_VAZIOS);
              }}
            >
              Limpar filtros
            </Button>
          </EmptyState>
        ) : (
          <EmptyState
            icone={<UsersThree size={40} weight="duotone" aria-hidden />}
            titulo="Nenhum cliente cadastrado"
            texto="Cadastre um cliente ou importe uma planilha CSV para começar."
          >
            <Link href={hrefNovo} className={classesBotao()}>
              <UserPlus size={18} weight="bold" aria-hidden />
              Novo cliente
            </Link>
            <Link href={hrefImportar} className={classesBotao()}>
              <UploadSimple size={18} weight="bold" aria-hidden />
              Importar CSV
            </Link>
          </EmptyState>
        )
      )}

      {data && data.content.length > 0 && (
        <ul className={`p-1.5 ${isFetching ? "opacity-70" : ""}`}>
          {data.content.map((c) => {
            const selecionado = c.id === selecionadoId;
            return (
              <li key={c.id}>
                <Link
                  href={hrefCliente(c.id)}
                  aria-current={selecionado ? "true" : undefined}
                  className={`flex items-center gap-3 rounded-ui px-3 py-2.5 ${selecionado ? "bg-line/40" : "hover:bg-line/25"}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.nomeRazaoSocial}</p>
                    <p className="truncate text-[13px] text-muted">
                      <span className="tabular-nums">{formatarDocumento(c.cpfCnpj)}</span>
                      {c.planoNome ? ` · ${c.planoNome}` : ""}
                    </p>
                  </div>
                  <Pill tom={c.status === "ATIVO" ? "ok" : "neutro"}>{c.status === "ATIVO" ? "Ativo" : "Inativo"}</Pill>
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
          {data.totalElements > TAMANHO_PAGINA && (
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
