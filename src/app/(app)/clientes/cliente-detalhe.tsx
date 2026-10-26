"use client";

import { CaretLeft, Trash, UsersThree } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, classesBotao } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { Pill } from "@/components/ui/pill";
import { Carregando } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatarDocumento } from "@/lib/documento";
import { NOTAS_FISCAIS_ATIVAS } from "@/lib/notas/modo";
import { useCliente, useRemoverCliente } from "@/lib/queries";

import { ClienteForm, ID_FORM_CLIENTE } from "./cliente-form";
import { GuiasDoCliente } from "./guias-do-cliente";
import { NotasDoCliente } from "./notas-do-cliente";

/** Painel de detalhe: edita o cliente no próprio painel (sem modal) ou cria um novo (id = null). */
export function ClienteDetalhe({
  id,
  hrefLista,
  hrefCliente,
}: {
  id: number | null;
  /** Volta para a lista preservando filtros e página. */
  hrefLista: string;
  hrefCliente: (id: number) => string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { estado } = useAuth();
  const { data: cliente, isPending, error } = useCliente(id);
  const remover = useRemoverCliente();
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const moldura = "rounded-ui border border-line border-l-[3px] border-l-accent bg-paper";

  if (id !== null && isPending) {
    return (
      <div className={`${moldura} p-6`}>
        <Carregando texto="Carregando cliente…" />
      </div>
    );
  }

  if (id !== null && !cliente) {
    const naoEncontrado = error instanceof ApiError && error.status === 404;
    return (
      <div className={moldura}>
        <EmptyState
          icone={<UsersThree size={40} weight="duotone" aria-hidden />}
          titulo={naoEncontrado ? "Cliente não encontrado" : "Não foi possível abrir o cliente"}
          texto={naoEncontrado ? "Ele pode ter sido excluído. Volte para a lista e escolha outro." : error?.message}
        >
          <Link href={hrefLista} className={classesBotao()}>
            Voltar para a lista
          </Link>
        </EmptyState>
      </div>
    );
  }

  const ehAdmin = estado.usuario?.papel === "ADMIN";

  async function excluir() {
    if (id === null) return;
    try {
      await remover.mutateAsync(id);
      toast.sucesso("Cliente excluído");
      router.replace(hrefLista);
    } catch (e) {
      setConfirmandoExclusao(false);
      toast.erro(e instanceof ApiError ? e.message : "Não foi possível excluir o cliente.");
    }
  }

  return (
    <div className={moldura}>
      <div className="flex items-start gap-2 border-b border-line p-4">
        <Link
          href={hrefLista}
          aria-label="Voltar para a lista"
          className="grid size-10 shrink-0 place-items-center rounded-ui hover:bg-line/40 min-[900px]:hidden"
        >
          <CaretLeft size={20} weight="bold" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl font-semibold">{cliente ? cliente.nomeRazaoSocial : "Novo cliente"}</h2>
          {cliente && (
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <span className="tabular-nums">{formatarDocumento(cliente.cpfCnpj)}</span>
              <Pill tom={cliente.status === "ATIVO" ? "ok" : "neutro"}>{cliente.status === "ATIVO" ? "Ativo" : "Inativo"}</Pill>
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {cliente && ehAdmin && (
            <Button variante="perigo" aria-label="Excluir cliente" onClick={() => setConfirmandoExclusao(true)}>
              <Trash size={18} weight="bold" aria-hidden />
              <span className="hidden sm:inline">Excluir</span>
            </Button>
          )}
          <Button type="submit" form={ID_FORM_CLIENTE} variante="primario" carregando={salvando}>
            {cliente ? "Salvar" : "Cadastrar"}
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <ClienteForm cliente={cliente ?? null} onSalvando={setSalvando} aoCriar={(novoId) => router.replace(hrefCliente(novoId))} />
        {cliente && (
          <div className="mt-5">
            {NOTAS_FISCAIS_ATIVAS && <NotasDoCliente clienteId={cliente.id} />}
            <GuiasDoCliente clienteId={cliente.id} />
          </div>
        )}
      </div>

      <Modal aberto={confirmandoExclusao} onFechar={() => setConfirmandoExclusao(false)} titulo="Excluir cliente?" largura="sm">
        <p>
          <strong>{cliente?.nomeRazaoSocial}</strong> sai da lista de clientes. O histórico fiscal e financeiro dele é mantido.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button data-autofocus onClick={() => setConfirmandoExclusao(false)}>
            Cancelar
          </Button>
          <Button variante="perigo" carregando={remover.isPending} onClick={excluir}>
            Excluir cliente
          </Button>
        </div>
      </Modal>
    </div>
  );
}
