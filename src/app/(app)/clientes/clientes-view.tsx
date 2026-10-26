"use client";

import { UploadSimple, UserPlus, UsersThree } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { classesBotao } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { FiltrosClientes } from "@/lib/queries";

import { ClienteDetalhe } from "./cliente-detalhe";
import { ClienteLista } from "./cliente-lista";
import { comParametros, filtrosDaUrl, filtrosParaParametros, urlClientes } from "./filtros-url";
import { ImportarDialog } from "./importar-dialog";

/**
 * Master-detail (docs/ui-ux.md, seção 6): a lista fica sempre visível e o
 * registro selecionado abre num painel ao lado — sem modal para ver/editar. Tudo que define a tela (cliente
 * aberto, filtros, página) está na URL, então qualquer visão é um link compartilhável. Abaixo de 900px os
 * dois viram telas em sequência (lista → detalhe).
 */
export function ClientesView() {
  const parametros = useSearchParams();
  const router = useRouter();

  const idParam = parametros.get("id");
  const id = idParam && /^\d+$/.test(idParam) ? Number(idParam) : null;
  const novo = parametros.get("novo") === "1";
  const importar = parametros.get("importar") === "1";
  const detalheAberto = id !== null || novo;
  const filtros = useMemo(() => filtrosDaUrl(parametros), [parametros]);

  /** URL desta tela com o patch aplicado, preservando os filtros e a página da lista. */
  const href = useCallback(
    (patch: Record<string, string | null>) => urlClientes(comParametros(parametros, patch)),
    [parametros],
  );
  const hrefLista = href({ id: null, novo: null, importar: null });
  const hrefCliente = useCallback((clienteId: number) => href({ id: String(clienteId), novo: null, importar: null }), [href]);

  const aoMudarFiltros = useCallback(
    (novos: FiltrosClientes) => router.replace(urlClientes(filtrosParaParametros(parametros, novos)), { scroll: false }),
    [parametros, router],
  );

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className={`mb-5 flex flex-wrap items-center justify-between gap-3 ${detalheAberto ? "max-[899px]:hidden" : ""}`}>
        <h1 className="font-display text-[25px] font-semibold sm:text-[32px]">Clientes</h1>
        <div className="flex gap-2">
          <Link href={href({ importar: "1" })} className={classesBotao()}>
            <UploadSimple size={18} weight="bold" aria-hidden />
            Importar CSV
          </Link>
          <Link href={href({ id: null, novo: "1" })} className={classesBotao(detalheAberto ? "secundario" : "primario")}>
            <UserPlus size={18} weight="bold" aria-hidden />
            Novo cliente
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 min-[900px]:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]">
        <section aria-label="Lista de clientes" className={detalheAberto ? "max-[899px]:hidden" : ""}>
          <ClienteLista
            filtros={filtros}
            onFiltros={aoMudarFiltros}
            selecionadoId={id}
            hrefCliente={hrefCliente}
            hrefNovo={href({ id: null, novo: "1" })}
            hrefImportar={href({ importar: "1" })}
          />
        </section>

        <section
          aria-label="Detalhe do cliente"
          className={`min-[900px]:sticky min-[900px]:top-4 ${detalheAberto ? "" : "max-[899px]:hidden"}`}
        >
          {detalheAberto ? (
            <ClienteDetalhe
              key={novo ? "novo" : id}
              id={novo ? null : id}
              hrefLista={hrefLista}
              hrefCliente={hrefCliente}
            />
          ) : (
            <div className="rounded-ui border border-dashed border-line">
              <EmptyState
                icone={<UsersThree size={40} weight="duotone" aria-hidden />}
                titulo="Selecione um cliente"
                texto="Os dados completos, o plano e o status aparecem aqui, ao lado da lista."
              />
            </div>
          )}
        </section>
      </div>

      <ImportarDialog aberto={importar} onFechar={() => router.replace(href({ importar: null }))} />
    </div>
  );
}
