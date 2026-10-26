"use client";

import { Barcode, CaretLeft } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Anexo } from "@/components/ui/anexo";
import { Button, classesBotao } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MenuAcoes, type ItemMenu } from "@/components/ui/menu-acoes";
import { Modal } from "@/components/ui/modal";
import { Pill } from "@/components/ui/pill";
import { Secao } from "@/components/ui/secao";
import { Carregando } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatarDocumento } from "@/lib/documento";
import { dataBR, dataHoraBR, moeda } from "@/lib/format";
import { classeDaData, ROTULO_SITUACAO, situacaoDaGuia, textoVencimento, TOM_SITUACAO } from "@/lib/guias";
import { useCliente } from "@/lib/queries";
import { useAcoesDaGuia, useGuia } from "@/lib/queries-guias";
import type { Guia } from "@/lib/types";

import { EstimativaDoAtraso } from "./estimativa-do-atraso";
import { GuiaForm, ID_FORM_GUIA } from "./guia-form";
import { MarcarPagaDialog } from "./marcar-paga-dialog";

const MOLDURA = "rounded-ui border border-line border-l-[3px] border-l-accent bg-paper";

const mensagemDe = (erro: unknown, padrao: string) => (erro instanceof Error ? erro.message : padrao);

interface Props {
  /** null = cadastro de uma guia nova. */
  id: number | null;
  /** Cliente pré-escolhido quando a guia nova nasce a partir de um cliente. */
  clienteIdInicial: number | null;
  /** Volta para a lista preservando filtros e página. */
  hrefLista: string;
  hrefGuia: (id: number) => string;
}

export function GuiaDetalhe({ id, clienteIdInicial, hrefLista, hrefGuia }: Props) {
  const { data: guia, isPending, error } = useGuia(id);

  if (id === null) return <GuiaNova clienteIdInicial={clienteIdInicial} hrefLista={hrefLista} hrefGuia={hrefGuia} />;

  if (isPending) {
    return (
      <div className={`${MOLDURA} p-6`}>
        <Carregando texto="Carregando guia…" />
      </div>
    );
  }

  if (!guia) {
    const naoEncontrada = error instanceof ApiError && error.status === 404;
    return (
      <div className={MOLDURA}>
        <EmptyState
          icone={<Barcode size={40} weight="duotone" aria-hidden />}
          titulo={naoEncontrada ? "Guia não encontrada" : "Não foi possível abrir a guia"}
          texto={naoEncontrada ? "Ela pode ter sido excluída. Volte para a lista e escolha outra." : error?.message}
        >
          <Link href={hrefLista} className={classesBotao()}>
            Voltar para a lista
          </Link>
        </EmptyState>
      </div>
    );
  }

  return <GuiaAberta guia={guia} hrefLista={hrefLista} />;
}

function VoltarParaALista({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Voltar para a lista"
      className="grid size-10 shrink-0 place-items-center rounded-ui hover:bg-line/40 min-[900px]:hidden"
    >
      <CaretLeft size={20} weight="bold" aria-hidden />
    </Link>
  );
}

function GuiaNova({ clienteIdInicial, hrefLista, hrefGuia }: Pick<Props, "clienteIdInicial" | "hrefLista" | "hrefGuia">) {
  const router = useRouter();
  const { data: cliente, isPending } = useCliente(clienteIdInicial);
  const [salvando, setSalvando] = useState(false);
  // O formulário nasce com o cliente já escolhido: espera o dado chegar para não montar vazio.
  const aguardandoCliente = clienteIdInicial !== null && isPending;

  return (
    <div className={MOLDURA}>
      <div className="flex items-center gap-2 border-b border-line p-4">
        <VoltarParaALista href={hrefLista} />
        <h2 className="min-w-0 flex-1 truncate font-display text-xl font-semibold">Nova guia</h2>
        <Button type="submit" form={ID_FORM_GUIA} variante="primario" carregando={salvando}>
          Cadastrar
        </Button>
      </div>
      <div className="p-4 sm:p-5">
        {aguardandoCliente ? (
          <Carregando texto="Carregando cliente…" />
        ) : (
          <GuiaForm
            guia={null}
            clienteInicial={cliente ? { id: cliente.id, nome: cliente.nomeRazaoSocial } : null}
            onSalvando={setSalvando}
            aoCriar={(novoId) => router.replace(hrefGuia(novoId))}
          />
        )}
      </div>
    </div>
  );
}

function GuiaAberta({ guia, hrefLista }: { guia: Guia; hrefLista: string }) {
  const router = useRouter();
  const toast = useToast();
  const { estado } = useAuth();
  const acoes = useAcoesDaGuia(guia.id);
  const [pagando, setPagando] = useState(false);
  const [confirmando, setConfirmando] = useState<"excluir" | "reabrir" | null>(null);
  const [salvando, setSalvando] = useState(false);

  const ehAdmin = estado.usuario?.papel === "ADMIN";
  const pendente = guia.status === "PENDENTE";
  const paga = guia.status === "PAGA";
  const cancelada = guia.status === "CANCELADA";
  const situacao = situacaoDaGuia(guia);

  async function cancelar() {
    try {
      await acoes.cancelar.mutateAsync();
      toast.sucesso("Guia cancelada");
    } catch (erro) {
      toast.erro(mensagemDe(erro, "Não foi possível cancelar a guia."));
    }
  }

  async function reabrir() {
    try {
      await acoes.reabrir.mutateAsync();
      toast.sucesso("Guia reaberta");
    } catch (erro) {
      toast.erro(mensagemDe(erro, "Não foi possível reabrir a guia."));
    } finally {
      setConfirmando(null);
    }
  }

  async function excluir() {
    try {
      await acoes.remover.mutateAsync();
      toast.sucesso("Guia excluída");
      router.replace(hrefLista);
    } catch (erro) {
      setConfirmando(null);
      toast.erro(mensagemDe(erro, "Não foi possível excluir a guia."));
    }
  }

  // Cabeçalho: no máximo 2 botões visíveis; o resto vai para o menu "⋯" (spec de design, componente "painel de detalhe").
  const itensDoMenu: ItemMenu[] = [];
  if (pendente) itensDoMenu.push({ rotulo: "Cancelar guia", aoSelecionar: cancelar });
  if (paga) itensDoMenu.push({ rotulo: "Reabrir guia (desfazer pagamento)", aoSelecionar: () => setConfirmando("reabrir") });
  if (ehAdmin) itensDoMenu.push({ rotulo: "Excluir guia", perigo: true, aoSelecionar: () => setConfirmando("excluir") });

  return (
    <div className={MOLDURA}>
      <div className="flex flex-wrap items-start gap-x-2 gap-y-3 border-b border-line p-4">
        <VoltarParaALista href={hrefLista} />
        <div className="min-w-0 flex-1 basis-44">
          <h2 className="truncate font-display text-xl font-semibold">{guia.descricao}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
            <Link href={`/clientes?id=${guia.clienteId}`} className="font-medium text-accent-text hover:underline">
              {guia.clienteNome}
            </Link>
            <span className="tabular-nums">{formatarDocumento(guia.clienteCpfCnpj)}</span>
            <Pill tom={TOM_SITUACAO[situacao]}>{ROTULO_SITUACAO[situacao]}</Pill>
          </p>
        </div>
        {/* Em tela estreita as ações descem para uma linha própria, em vez de espremer o título. */}
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {pendente && (
            <Button variante="primario" className="flex-1 sm:flex-none" onClick={() => setPagando(true)}>
              Marcar como paga
            </Button>
          )}
          {cancelada && (
            <Button className="flex-1 sm:flex-none" carregando={acoes.reabrir.isPending} onClick={reabrir}>
              Reabrir guia
            </Button>
          )}
          <MenuAcoes rotulo="Mais ações da guia" itens={itensDoMenu} />
        </div>
      </div>

      <div className="px-4 pt-4 sm:px-5">
        <p className="font-display text-[34px] font-bold leading-none tabular-nums">{moeda(guia.valor)}</p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className={`font-semibold ${classeDaData(guia)}`}>{textoVencimento(guia)}</span>
          <span className="text-muted">· vencimento {dataBR(guia.vencimento)}</span>
        </p>
      </div>

      <div className="mt-2 px-4 sm:px-5">
        {pendente && guia.vencida && (
          <Secao titulo="Quanto custa pagar" resumo="Estimativa">
            <EstimativaDoAtraso guia={guia} />
          </Secao>
        )}

        <Secao titulo="Dados da guia">
          <GuiaForm guia={guia} somenteLeitura={!pendente} onSalvando={setSalvando} aoCriar={() => undefined} />
          {salvando && <span className="sr-only" role="status">Salvando…</span>}
        </Secao>

        <Secao titulo="PDF da guia" resumo={guia.arquivo ? undefined : "Não anexado"}>
          <Anexo
            titulo="PDF da guia"
            arquivo={guia.arquivo}
            caminho={`/guias/${guia.id}/arquivo`}
            aceita="application/pdf,.pdf"
            textoAnexar="Anexar PDF"
            textoVazio="Nenhum PDF anexado a esta guia."
            ocupado={acoes.anexarArquivo.isPending || acoes.removerArquivo.isPending}
            onEnviar={async (arquivo) => {
              await acoes.anexarArquivo.mutateAsync(arquivo);
              toast.sucesso("PDF anexado");
            }}
            onRemover={async () => {
              await acoes.removerArquivo.mutateAsync();
              toast.sucesso("PDF removido");
            }}
          />
        </Secao>

        {paga && (
          <Secao titulo="Pagamento">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-[13px] text-muted">Data do pagamento</dt>
                <dd className="font-medium tabular-nums">{dataBR(guia.dataPagamento)}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Registrado por</dt>
                <dd className="font-medium">
                  {guia.pagoPorNome ?? "—"}
                  {guia.pagoEm && <span className="font-normal text-muted"> em {dataHoraBR(guia.pagoEm)}</span>}
                </dd>
              </div>
            </dl>
            <p className="mb-1.5 mt-4 text-[13px] font-medium">Comprovante</p>
            <Anexo
              titulo="comprovante"
              arquivo={guia.comprovante}
              caminho={`/guias/${guia.id}/comprovante`}
              aceita="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
              textoAnexar="Anexar comprovante"
              textoVazio="Nenhum comprovante anexado."
              ocupado={acoes.anexarComprovante.isPending || acoes.removerComprovante.isPending}
              onEnviar={async (arquivo) => {
                await acoes.anexarComprovante.mutateAsync(arquivo);
                toast.sucesso("Comprovante anexado");
              }}
              onRemover={async () => {
                await acoes.removerComprovante.mutateAsync();
                toast.sucesso("Comprovante removido");
              }}
            />
          </Secao>
        )}
      </div>

      <MarcarPagaDialog aberto={pagando} onFechar={() => setPagando(false)} guia={guia} acao={acoes.marcarPaga} />

      <Modal aberto={confirmando === "reabrir"} onFechar={() => setConfirmando(null)} titulo="Reabrir a guia?" largura="sm">
        <p>
          A guia volta a ficar pendente e <strong>a data do pagamento e o comprovante são apagados</strong>. Use isto quando o
          pagamento foi registrado por engano.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button data-autofocus onClick={() => setConfirmando(null)}>
            Cancelar
          </Button>
          <Button variante="perigo" carregando={acoes.reabrir.isPending} onClick={reabrir}>
            Reabrir guia
          </Button>
        </div>
      </Modal>

      <Modal aberto={confirmando === "excluir"} onFechar={() => setConfirmando(null)} titulo="Excluir guia?" largura="sm">
        <p>
          <strong>{guia.descricao}</strong> sai da lista de guias. O histórico é mantido. Para só desistir da guia, prefira
          cancelá-la.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button data-autofocus onClick={() => setConfirmando(null)}>
            Cancelar
          </Button>
          <Button variante="perigo" carregando={acoes.remover.isPending} onClick={excluir}>
            Excluir guia
          </Button>
        </div>
      </Modal>
    </div>
  );
}
