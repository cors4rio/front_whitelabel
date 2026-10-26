"use client";

import { FileText, Gear, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { AvisosDasNotas } from "@/components/notas/avisos";
import { classesBotao } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NOTAS_FISCAIS_ATIVAS } from "@/lib/notas/modo";
import type { FiltrosNotas } from "@/lib/notas/queries";

import { comParametros, filtrosNotasDaUrl, filtrosNotasParaParametros, urlNotas } from "./filtros-url";
import { NotaDetalhe } from "./nota-detalhe";
import { NotaLista } from "./nota-lista";

/**
 * Notas fiscais em lista e detalhe lado a lado (docs/ui-ux.md, seção 8), no mesmo padrão
 * de Guias e Clientes: tudo que define a tela (nota aberta, filtros, página) está na URL. Abaixo de 900px, lista →
 * detalhe em sequência. Visão do escritório: quem usa é ADMIN/COLABORADOR; o cliente final não acessa esta tela.
 */
export function NotasView() {
  const parametros = useSearchParams();
  const router = useRouter();

  const idParam = parametros.get("id");
  const id = idParam && /^\d+$/.test(idParam) ? Number(idParam) : null;
  const novo = parametros.get("novo") === "1";
  const copiarParam = parametros.get("copiar");
  const copiarDeId = copiarParam && /^\d+$/.test(copiarParam) ? Number(copiarParam) : null;
  const detalheAberto = id !== null || novo;
  const filtros = useMemo(() => filtrosNotasDaUrl(parametros), [parametros]);
  const clienteDoFiltro = filtros.clienteId ? Number(filtros.clienteId) : null;

  /** URL desta tela com o patch aplicado, preservando filtros e página da lista. */
  const href = useCallback(
    (patch: Record<string, string | null>) => urlNotas(comParametros(parametros, patch)),
    [parametros],
  );
  const hrefLista = href({ id: null, novo: null, copiar: null });
  const hrefNova = href({ id: null, novo: "1", copiar: null });
  const hrefNota = useCallback((notaId: number) => href({ id: String(notaId), novo: null, copiar: null }), [href]);
  const hrefCopia = useCallback((notaId: number) => href({ id: null, novo: "1", copiar: String(notaId) }), [href]);

  const aoMudarFiltros = useCallback(
    (novos: FiltrosNotas) => router.replace(urlNotas(filtrosNotasParaParametros(parametros, novos)), { scroll: false }),
    [parametros, router],
  );

  if (!NOTAS_FISCAIS_ATIVAS) {
    return (
      <div className="mx-auto max-w-[1400px] rounded-ui border border-dashed border-line">
        <EmptyState
          icone={<FileText size={40} weight="duotone" aria-hidden />}
          titulo="Notas fiscais ainda não estão disponíveis"
          texto="Este módulo ainda não foi ativado nesta instalação."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className={`mb-5 flex flex-wrap items-center justify-between gap-3 ${detalheAberto ? "max-[899px]:hidden" : ""}`}>
        <h1 className="font-display text-[25px] font-semibold sm:text-[32px]">Notas fiscais</h1>
        <div className="flex gap-2">
          <Link href="/notas-fiscais/configuracao" className={classesBotao()}>
            <Gear size={18} weight="bold" aria-hidden />
            <span className="max-[479px]:sr-only">Configuração fiscal</span>
          </Link>
          {/* Uma só ação primária por tela: com o detalhe aberto, o primário é o do próprio detalhe. */}
          <Link href={hrefNova} className={classesBotao(detalheAberto ? "secundario" : "primario")}>
            <Plus size={18} weight="bold" aria-hidden />
            Emitir nota
          </Link>
        </div>
      </header>

      <div className={detalheAberto ? "max-[899px]:hidden" : ""}>
        <AvisosDasNotas />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 min-[900px]:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]">
        <section aria-label="Lista de notas fiscais" className={detalheAberto ? "max-[899px]:hidden" : ""}>
          <NotaLista filtros={filtros} onFiltros={aoMudarFiltros} selecionadaId={id} hrefNota={hrefNota} hrefNova={hrefNova} />
        </section>

        {/* A nota tem formulário e várias seções: se for mais alta que a tela, rola dentro do painel em vez de ficar cortada. */}
        <section
          aria-label="Detalhe da nota fiscal"
          className={`min-[900px]:sticky min-[900px]:top-4 min-[900px]:max-h-[calc(100dvh-2rem)] min-[900px]:overflow-y-auto min-[900px]:rounded-ui ${
            detalheAberto ? "" : "max-[899px]:hidden"
          }`}
        >
          {detalheAberto ? (
            <NotaDetalhe
              key={novo ? `nova-${copiarDeId ?? ""}` : id}
              id={novo ? null : id}
              clienteIdInicial={novo ? clienteDoFiltro : null}
              copiarDeId={novo ? copiarDeId : null}
              hrefLista={hrefLista}
              hrefNota={hrefNota}
              hrefCopia={hrefCopia}
            />
          ) : (
            <div className="rounded-ui border border-dashed border-line">
              <EmptyState
                icone={<FileText size={40} weight="duotone" aria-hidden />}
                titulo="Selecione uma nota"
                texto="Dados, situação, linha do tempo e arquivos aparecem aqui, ao lado da lista."
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
