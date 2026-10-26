"use client";

import { CaretLeft, FileText, Gear } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { AvisosDasNotas } from "@/components/notas/avisos";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Carregando } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth";
import { NOTAS_FISCAIS_ATIVAS } from "@/lib/notas/modo";
import { FILTROS_PERFIS_PADRAO, useConfiguracaoFiscal, type FiltrosPerfis } from "@/lib/notas/queries";
import type { FiltroPerfil } from "@/lib/types";
import { comParametros, urlComParametros } from "@/lib/url";

import { AmbienteCard } from "./ambiente-card";
import { PerfilDetalhe } from "./perfil-detalhe";
import { PerfisLista } from "./perfis-lista";

const SITUACOES: FiltroPerfil[] = ["TODOS", "PRONTOS", "PENDENTES", "NAO_CONFIGURADOS"];
const ROTA = "/notas-fiscais/configuracao";

function filtrosDaUrl(params: URLSearchParams): FiltrosPerfis {
  const situacao = params.get("situacao") as FiltroPerfil | null;
  const pagina = Number(params.get("pagina") ?? 0);
  return {
    busca: params.get("busca") ?? "",
    situacao: situacao && SITUACOES.includes(situacao) ? situacao : FILTROS_PERFIS_PADRAO.situacao,
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 0,
  };
}

/**
 * Os dados fiscais de cada cliente, em lista e detalhe lado a lado (mesmo padrão de Clientes e Notas): o cliente
 * aberto, a busca, o filtro e a página estão na URL. Só administradores alteram; o colaborador consulta. O ambiente
 * (homologação ou produção) é o único ajuste do escritório todo e fica no topo.
 */
export function ConfiguracaoView() {
  const { estado } = useAuth();
  const parametros = useSearchParams();
  const router = useRouter();
  const { data: config, isPending, isError, error, refetch } = useConfiguracaoFiscal();
  const ehAdmin = estado.usuario?.papel === "ADMIN";

  const clienteParam = parametros.get("cliente");
  const clienteId = clienteParam && /^\d+$/.test(clienteParam) ? Number(clienteParam) : null;
  const detalheAberto = clienteId !== null;
  const filtros = useMemo(() => filtrosDaUrl(parametros), [parametros]);

  const href = useCallback((patch: Record<string, string | null>) => urlComParametros(ROTA, comParametros(parametros, patch)), [parametros]);
  const hrefLista = href({ cliente: null });
  const hrefCliente = useCallback((id: number) => href({ cliente: String(id) }), [href]);
  const aoMudarFiltros = useCallback(
    (novos: FiltrosPerfis) =>
      router.replace(
        urlComParametros(
          ROTA,
          comParametros(parametros, {
            busca: novos.busca.trim() || null,
            situacao: novos.situacao === FILTROS_PERFIS_PADRAO.situacao ? null : novos.situacao,
            pagina: novos.pagina > 0 ? String(novos.pagina) : null,
          }),
        ),
        { scroll: false },
      ),
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
      <div className={detalheAberto ? "max-[899px]:hidden" : ""}>
        <Link href="/notas-fiscais" className="mb-2 inline-flex h-9 items-center gap-1 rounded-ui pr-2 text-[13px] font-medium text-accent-text hover:underline">
          <CaretLeft size={14} weight="bold" aria-hidden />
          Notas fiscais
        </Link>
        <h1 className="font-display text-[25px] font-semibold sm:text-[32px]">Configuração fiscal</h1>
        <p className="mb-5 mt-1 max-w-[70ch] text-muted">
          A nota sai em nome do cliente: cada um precisa dos próprios dados fiscais, do certificado digital (ou do acesso ao portal) e da lista de tomadores. Escolha um
          cliente para configurar.
        </p>

        <AvisosDasNotas apenasDemonstracao />

        {isPending && <Carregando texto="Carregando a configuração…" />}

        {isError && (
          <div className="mb-5">
            <p className="text-crimson">{error instanceof Error ? error.message : "Não foi possível carregar a configuração fiscal."}</p>
            <Button className="mt-3" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          </div>
        )}

        {config && (
          <div className="mb-5 flex flex-col gap-3">
            {!ehAdmin && (
              <p role="note" className="rounded-ui border border-line px-4 py-3 text-[13px] text-muted">
                <Gear size={14} weight="bold" className="mr-1 inline align-[-2px]" aria-hidden />
                Só administradores alteram a configuração fiscal. Você pode consultar o estado de cada cliente; para mudar algo, fale com um administrador.
              </p>
            )}
            <AmbienteCard ambiente={config.ambiente} somenteLeitura={!ehAdmin} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 min-[900px]:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]">
        <section aria-label="Clientes" className={detalheAberto ? "max-[899px]:hidden" : ""}>
          <PerfisLista filtros={filtros} onFiltros={aoMudarFiltros} selecionadoId={clienteId} hrefCliente={hrefCliente} />
        </section>

        {/* O detalhe tem várias seções: se for mais alto que a tela, rola dentro do painel em vez de ficar cortado. */}
        <section
          aria-label="Dados fiscais do cliente"
          className={`min-[900px]:sticky min-[900px]:top-4 min-[900px]:max-h-[calc(100dvh-2rem)] min-[900px]:overflow-y-auto min-[900px]:rounded-ui ${
            detalheAberto ? "" : "max-[899px]:hidden"
          }`}
        >
          {detalheAberto ? (
            <PerfilDetalhe key={clienteId} clienteId={clienteId} hrefLista={hrefLista} somenteLeitura={!ehAdmin} />
          ) : (
            <div className="rounded-ui border border-dashed border-line">
              <EmptyState
                icone={<FileText size={40} weight="duotone" aria-hidden />}
                titulo="Selecione um cliente"
                texto="Situação da emissão, dados fiscais, certificado ou portal e tomadores aparecem aqui, ao lado da lista."
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
