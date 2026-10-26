"use client";

import { Plus } from "@phosphor-icons/react";
import { useState } from "react";

import { TomadorDialog } from "@/components/notas/tomador-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { MenuAcoes } from "@/components/ui/menu-acoes";
import { Modal } from "@/components/ui/modal";
import { Carregando } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { formatarDocumento } from "@/lib/documento";
import { numero } from "@/lib/format";
import { useExcluirTomador, useTomadores } from "@/lib/notas/queries";
import type { Tomador } from "@/lib/types";

const TAMANHO = 50;

/** A lista de tomadores (quem contrata o serviço) deste cliente: é daqui que o formulário da nota escolhe o tomador. */
export function TomadoresSecao({ clienteId, somenteLeitura }: { clienteId: number; somenteLeitura: boolean }) {
  const toast = useToast();
  const [busca, setBusca] = useState("");
  const { data, isPending, isError, refetch } = useTomadores(clienteId, busca, TAMANHO);
  const excluir = useExcluirTomador(clienteId);
  const [editando, setEditando] = useState<Tomador | null>(null);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [removendo, setRemovendo] = useState<Tomador | null>(null);

  const total = data?.totalElements ?? 0;

  async function confirmarRemocao() {
    if (!removendo) return;
    try {
      await excluir.mutateAsync(removendo.id);
      toast.sucesso("Tomador removido da lista");
    } catch (erro) {
      toast.erro(erro instanceof Error ? erro.message : "Não foi possível remover o tomador.");
    } finally {
      setRemovendo(null);
    }
  }

  return (
    <div>
      <p className="mb-3 text-muted">Quem contrata os serviços deste cliente. Ao emitir uma nota, o tomador é escolhido desta lista.</p>

      {(total > 5 || busca) && (
        <Input type="search" aria-label="Buscar tomador por nome ou CPF/CNPJ" placeholder="Buscar tomador" className="mb-3" value={busca} onChange={(e) => setBusca(e.target.value)} />
      )}

      {isPending && <Carregando texto="Carregando tomadores…" />}
      {isError && (
        <div>
          <p className="text-crimson">Não foi possível carregar os tomadores.</p>
          <Button className="mt-2" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {data && data.content.length === 0 && (
        <p className="rounded-ui border border-dashed border-line px-3.5 py-3 text-muted">
          {busca ? "Nenhum tomador corresponde à busca." : "Nenhum tomador cadastrado para este cliente ainda."}
        </p>
      )}

      {data && data.content.length > 0 && (
        <ul className="divide-y divide-line rounded-ui border border-line">
          {data.content.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 py-2 pl-3 pr-1.5">
              <div className="min-w-0">
                <p className="truncate font-medium">{t.nome}</p>
                <p className="truncate text-[13px] tabular-nums text-muted">
                  {formatarDocumento(t.documento)}
                  {t.email && ` · ${t.email}`}
                </p>
              </div>
              {!somenteLeitura && (
                <MenuAcoes
                  rotulo={`Ações para ${t.nome}`}
                  itens={[
                    {
                      rotulo: "Editar",
                      aoSelecionar: () => {
                        setEditando(t);
                        setDialogoAberto(true);
                      },
                    },
                    { rotulo: "Remover da lista", perigo: true, aoSelecionar: () => setRemovendo(t) },
                  ]}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {data && total > data.content.length && (
        <p className="mt-1.5 text-[13px] text-muted">
          Mostrando {numero(data.content.length)} de {numero(total)}. Use a busca para achar os demais.
        </p>
      )}

      {!somenteLeitura && (
        <div className="mt-3">
          <Button
            pequeno
            onClick={() => {
              setEditando(null);
              setDialogoAberto(true);
            }}
          >
            <Plus size={14} weight="bold" aria-hidden />
            Novo tomador
          </Button>
        </div>
      )}

      <TomadorDialog aberto={dialogoAberto} onFechar={() => setDialogoAberto(false)} clienteId={clienteId} tomador={editando} onSalvo={() => setDialogoAberto(false)} />

      <Modal aberto={removendo !== null} onFechar={() => setRemovendo(null)} titulo="Remover o tomador da lista?" largura="sm">
        <p>
          <strong>{removendo?.nome}</strong> sai da lista deste cliente. As notas que já foram emitidas para ele continuam como estão.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button data-autofocus onClick={() => setRemovendo(null)}>
            Voltar
          </Button>
          <Button variante="perigo" carregando={excluir.isPending} onClick={confirmarRemocao}>
            Remover tomador
          </Button>
        </div>
      </Modal>
    </div>
  );
}
