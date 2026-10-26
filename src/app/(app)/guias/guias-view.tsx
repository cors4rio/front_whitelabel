"use client";

import { Barcode, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { classesBotao } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { FiltrosGuias } from "@/lib/queries-guias";

import { filtrosGuiasDaUrl, filtrosGuiasParaParametros, comParametros, urlGuias } from "./filtros-url";
import { GuiaDetalhe } from "./guia-detalhe";
import { GuiaLista } from "./guia-lista";

/**
 * Lista e detalhe lado a lado (docs/ui-ux.md, seção 9), no mesmo padrão de Clientes:
 * tudo que define a tela (guia aberta, filtros, página) está na URL. Abaixo de 900px, lista → detalhe em sequência.
 * Visão do escritório: quem usa é ADMIN/COLABORADOR; o cliente final não acessa esta tela.
 */
export function GuiasView() {
  const parametros = useSearchParams();
  const router = useRouter();

  const idParam = parametros.get("id");
  const id = idParam && /^\d+$/.test(idParam) ? Number(idParam) : null;
  const novo = parametros.get("novo") === "1";
  const detalheAberto = id !== null || novo;
  const filtros = useMemo(() => filtrosGuiasDaUrl(parametros), [parametros]);
  const clienteDoFiltro = filtros.clienteId ? Number(filtros.clienteId) : null;

  /** URL desta tela com o patch aplicado, preservando filtros e página da lista. */
  const href = useCallback(
    (patch: Record<string, string | null>) => urlGuias(comParametros(parametros, patch)),
    [parametros],
  );
  const hrefLista = href({ id: null, novo: null });
  const hrefGuia = useCallback((guiaId: number) => href({ id: String(guiaId), novo: null }), [href]);

  const aoMudarFiltros = useCallback(
    (novos: FiltrosGuias) => router.replace(urlGuias(filtrosGuiasParaParametros(parametros, novos)), { scroll: false }),
    [parametros, router],
  );

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className={`mb-5 flex flex-wrap items-center justify-between gap-3 ${detalheAberto ? "max-[899px]:hidden" : ""}`}>
        <h1 className="font-display text-[25px] font-semibold sm:text-[32px]">Guias</h1>
        {/* Uma só ação primária por tela: com o detalhe aberto, o primário é o do próprio detalhe. */}
        <Link href={href({ id: null, novo: "1" })} className={classesBotao(detalheAberto ? "secundario" : "primario")}>
          <Plus size={18} weight="bold" aria-hidden />
          Nova guia
        </Link>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 min-[900px]:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]">
        <section aria-label="Lista de guias" className={detalheAberto ? "max-[899px]:hidden" : ""}>
          <GuiaLista
            filtros={filtros}
            onFiltros={aoMudarFiltros}
            selecionadaId={id}
            hrefGuia={hrefGuia}
            hrefNova={href({ id: null, novo: "1" })}
          />
        </section>

        <section
          aria-label="Detalhe da guia"
          className={`min-[900px]:sticky min-[900px]:top-4 ${detalheAberto ? "" : "max-[899px]:hidden"}`}
        >
          {detalheAberto ? (
            <GuiaDetalhe
              key={novo ? "nova" : id}
              id={novo ? null : id}
              clienteIdInicial={novo ? clienteDoFiltro : null}
              hrefLista={hrefLista}
              hrefGuia={hrefGuia}
            />
          ) : (
            <div className="rounded-ui border border-dashed border-line">
              <EmptyState
                icone={<Barcode size={40} weight="duotone" aria-hidden />}
                titulo="Selecione uma guia"
                texto="Valor, vencimento, PDF e pagamento aparecem aqui, ao lado da lista."
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
