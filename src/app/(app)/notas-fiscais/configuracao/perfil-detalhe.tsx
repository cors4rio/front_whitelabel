"use client";

import { CaretLeft, FileText, Plus } from "@phosphor-icons/react";
import Link from "next/link";

import { Button, classesBotao } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Secao } from "@/components/ui/secao";
import { Carregando } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api";
import { formatarDocumento } from "@/lib/documento";
import { usePerfil } from "@/lib/notas/queries";

import { CertificadoSecao } from "./certificado-secao";
import { MovimentoSecao } from "./movimento-secao";
import { PerfilForm } from "./perfil-form";
import { PortalSecao } from "./portal-secao";
import { ProntidaoLista } from "./prontidao-lista";
import { TomadoresSecao } from "./tomadores-secao";

const MOLDURA = "rounded-ui border border-line border-l-[3px] border-l-accent bg-paper";

/**
 * Tudo o que a emissão pede para um cliente: situação (pré-requisitos e teste de conexão), dados fiscais, acesso
 * (certificado ou portal, conforme o modo) e tomadores. Só administradores alteram.
 */
export function PerfilDetalhe({ clienteId, hrefLista, somenteLeitura }: { clienteId: number; hrefLista: string; somenteLeitura: boolean }) {
  const { data: perfil, isPending, error, refetch } = usePerfil(clienteId);

  if (isPending) {
    return (
      <div className={`${MOLDURA} p-6`}>
        <Carregando texto="Carregando dados fiscais…" />
      </div>
    );
  }

  if (!perfil) {
    const naoEncontrado = error instanceof ApiError && error.status === 404;
    return (
      <div className={MOLDURA}>
        <EmptyState
          icone={<FileText size={40} weight="duotone" aria-hidden />}
          titulo={naoEncontrado ? "Cliente não encontrado" : "Não foi possível abrir os dados fiscais"}
          texto={naoEncontrado ? "Ele pode ter sido excluído. Volte para a lista e escolha outro." : error?.message}
        >
          {!naoEncontrado && <Button onClick={() => refetch()}>Tentar de novo</Button>}
          <Link href={hrefLista} className={classesBotao()}>
            Voltar para a lista
          </Link>
        </EmptyState>
      </div>
    );
  }

  const canaisDisponiveis = perfil.canais.filter((c) => c.disponivel);
  const municipalDisponivel = perfil.canais.some((c) => c.canal === "MUNICIPAL_SALVADOR" && c.disponivel);

  return (
    <article className={`${MOLDURA} px-4 pb-1 pt-4 sm:px-5`} aria-labelledby="titulo-perfil">
      <header className="mb-3 flex items-start gap-2">
        <Link href={hrefLista} aria-label="Voltar para a lista" className="grid size-10 shrink-0 place-items-center rounded-ui hover:bg-line/40 min-[900px]:hidden">
          <CaretLeft size={20} weight="bold" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 id="titulo-perfil" className="break-words font-display text-xl font-semibold">
            {perfil.clienteNome}
          </h2>
          <p className="text-[13px] tabular-nums text-muted">{formatarDocumento(perfil.clienteDocumento)}</p>
        </div>
      </header>
      <div className="mb-3 flex flex-wrap gap-2">
        <Link href={`/clientes?id=${perfil.clienteId}`} className={classesBotao("fantasma", true)}>
          Ver cliente
        </Link>
        <Link href={`/notas-fiscais?clienteId=${perfil.clienteId}`} className={classesBotao("fantasma", true)}>
          Notas deste cliente
        </Link>
        {perfil.pronta && (
          <Link href={`/notas-fiscais?novo=1&clienteId=${perfil.clienteId}`} className={classesBotao("secundario", true)}>
            <Plus size={14} weight="bold" aria-hidden />
            Emitir nota
          </Link>
        )}
      </div>

      <Secao titulo="Pronto para emitir?" resumo={!perfil.configurado ? "Sem dados fiscais" : perfil.pronta ? "Pronto" : "Pendente"}>
        <div className="flex flex-col gap-4">
          {canaisDisponiveis.map((c) => (
            <ProntidaoLista key={c.canal} perfil={perfil} canal={c} podeTestar={!somenteLeitura} comTitulo={canaisDisponiveis.length > 1} />
          ))}
        </div>
        {!perfil.canais.every((c) => c.disponivel) && perfil.configurado && (
          <p className="mt-3 text-[13px] text-muted">O canal municipal (portal da Prefeitura) só existe para clientes de Salvador.</p>
        )}
      </Secao>

      <Secao titulo="Dados fiscais">
        {/* key: ao trocar de cliente, o formulário recomeça com os dados do novo. */}
        <PerfilForm key={perfil.clienteId} perfil={perfil} somenteLeitura={somenteLeitura} />
      </Secao>

      <Secao titulo="Certificado digital A1" resumo={perfil.configurado ? "Canal nacional" : "Salve os dados fiscais antes"}>
        {perfil.configurado ? (
          <CertificadoSecao key={perfil.clienteId} perfil={perfil} somenteLeitura={somenteLeitura} />
        ) : (
          <p className="rounded-ui border border-dashed border-line px-3.5 py-3 text-muted">
            Salve primeiro os dados fiscais acima. Depois você envia o certificado do cliente (canal nacional); se ele for de Salvador, também pode informar o
            acesso ao portal da prefeitura.
          </p>
        )}
      </Secao>

      {perfil.configurado && municipalDisponivel && (
        <Secao titulo="Acesso ao portal de Salvador" resumo="Canal municipal">
          <PortalSecao key={perfil.clienteId} perfil={perfil} somenteLeitura={somenteLeitura} />
        </Secao>
      )}

      {perfil.configurado && municipalDisponivel && perfil.portal && (
        <Secao titulo="Movimento no portal de Salvador" resumo="Só leitura" aberta={false}>
          <MovimentoSecao key={perfil.clienteId} perfil={perfil} />
        </Secao>
      )}

      <Secao titulo="Tomadores">
        <TomadoresSecao clienteId={perfil.clienteId} somenteLeitura={somenteLeitura} />
      </Secao>
    </article>
  );
}
