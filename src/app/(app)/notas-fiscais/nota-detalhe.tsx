"use client";

import { CaretLeft, FileText } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LinhaDoTempo } from "@/components/notas/linha-do-tempo";
import { StatusDaNota } from "@/components/notas/status-da-nota";
import { Button, classesBotao } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MenuAcoes, type ItemMenu } from "@/components/ui/menu-acoes";
import { Modal } from "@/components/ui/modal";
import { Pill } from "@/components/ui/pill";
import { Secao } from "@/components/ui/secao";
import { Carregando, Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { abrirArquivo, baixarArquivo } from "@/lib/arquivos";
import { useAuth } from "@/lib/auth";
import { formatarDocumento } from "@/lib/documento";
import { dataHoraBR, moeda } from "@/lib/format";
import { apiNotasBlob } from "@/lib/notas/cliente-api";
import { useExcluirNota, useNota } from "@/lib/notas/queries";
import {
  AVISO_CANAL_MUNICIPAL,
  formatarChaveDeAcesso,
  fraseDaSituacao,
  nomeDoArquivoDaNota,
  notaEditavel,
  notaEmProcessamento,
  rotuloDoMotivo,
  ROTULO_AMBIENTE,
} from "@/lib/notas/regras";
import { useCliente } from "@/lib/queries";
import type { NotaFiscal } from "@/lib/types";

import { CancelarDialog } from "./cancelar-dialog";
import { CaixaDeRejeicao } from "./caixa-de-rejeicao";
import { ID_FORM_NOTA, NotaForm, type PartidaDaNota } from "./nota-form";
import { Item, NotaResumo } from "./nota-resumo";

const MOLDURA = "rounded-ui border border-line border-l-[3px] border-l-accent bg-paper";

interface Props {
  /** null = nota nova. */
  id: number | null;
  /** Cliente pré-escolhido quando a nota nova nasce a partir de um cliente. */
  clienteIdInicial: number | null;
  /** Nota de que a nova copia os dados. */
  copiarDeId: number | null;
  /** Volta para a lista preservando filtros e página. */
  hrefLista: string;
  hrefNota: (id: number) => string;
  hrefCopia: (id: number) => string;
}

export function NotaDetalhe({ id, clienteIdInicial, copiarDeId, hrefLista, hrefNota, hrefCopia }: Props) {
  const consulta = useNota(id);
  const { data: nota, isPending, error } = consulta;

  if (id === null) return <NotaNova clienteIdInicial={clienteIdInicial} copiarDeId={copiarDeId} hrefLista={hrefLista} hrefNota={hrefNota} />;

  if (isPending) {
    return (
      <div className={`${MOLDURA} p-6`}>
        <Carregando texto="Carregando nota…" />
      </div>
    );
  }

  if (!nota) {
    const naoEncontrada = error instanceof ApiError && error.status === 404;
    return (
      <div className={MOLDURA}>
        <EmptyState
          icone={<FileText size={40} weight="duotone" aria-hidden />}
          titulo={naoEncontrada ? "Nota não encontrada" : "Não foi possível abrir a nota"}
          texto={naoEncontrada ? "Ela pode ter sido excluída. Volte para a lista e escolha outra." : error?.message}
        >
          <Link href={hrefLista} className={classesBotao()}>
            Voltar para a lista
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <NotaAberta nota={nota} hrefLista={hrefLista} hrefCopia={hrefCopia} atualizando={consulta.isFetching} atualizar={() => consulta.refetch()} />
  );
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

function NotaNova({ clienteIdInicial, copiarDeId, hrefLista, hrefNota }: Pick<Props, "clienteIdInicial" | "copiarDeId" | "hrefLista" | "hrefNota">) {
  const router = useRouter();
  const { data: cliente, isPending: carregandoCliente } = useCliente(clienteIdInicial);
  const { data: copia, isPending: carregandoCopia, isError: falhouCopia } = useNota(copiarDeId);
  const [salvando, setSalvando] = useState(false);

  // O formulário nasce com tudo escolhido (cliente e cópia): espera os dados chegarem para não montar vazio.
  const aguardando = (clienteIdInicial !== null && carregandoCliente) || (copiarDeId !== null && carregandoCopia);

  const partida: PartidaDaNota = {
    cliente: cliente
      ? { id: cliente.id, nome: cliente.nomeRazaoSocial }
      : copia?.clienteId != null
        ? { id: copia.clienteId, nome: copia.prestadorNome }
        : null,
    copia: copia ?? null,
  };

  return (
    <div className={MOLDURA}>
      <div className="flex items-center gap-2 border-b border-line p-4">
        <VoltarParaALista href={hrefLista} />
        <h2 className="min-w-0 flex-1 truncate font-display text-xl font-semibold">Nova nota fiscal</h2>
        <Button type="submit" form={ID_FORM_NOTA} variante="primario" carregando={salvando} disabled={aguardando}>
          Revisar e emitir
        </Button>
      </div>
      <div className="p-4 sm:p-5">
        {aguardando ? (
          <Carregando texto="Preparando o formulário…" />
        ) : (
          <>
            {copia && (
              <p className="mb-4 rounded-ui border border-line px-3 py-2 text-[13px] text-muted">
                Dados copiados da nota{copia.numero && <> nº {copia.numero}</>} de <strong className="text-fg">{copia.prestadorNome}</strong> para <strong className="text-fg">{copia.tomadorNome}</strong>. Confira a data do
                serviço e a descrição antes de emitir.
              </p>
            )}
            {falhouCopia && <p className="mb-4 text-crimson">Não foi possível carregar a nota de origem. Preencha os dados normalmente.</p>}
            <NotaForm nota={null} partida={partida} onSalvando={setSalvando} aoCriar={(novoId) => router.replace(hrefNota(novoId))} />
          </>
        )}
      </div>
    </div>
  );
}

interface PropsAberta {
  nota: NotaFiscal;
  hrefLista: string;
  hrefCopia: (id: number) => string;
  atualizando: boolean;
  atualizar: () => void;
}

function NotaAberta({ nota, hrefLista, hrefCopia, atualizando, atualizar }: PropsAberta) {
  const router = useRouter();
  const toast = useToast();
  const { estado } = useAuth();
  const excluir = useExcluirNota();
  const [dialogo, setDialogo] = useState<"cancelar" | "excluir" | null>(null);
  const [salvando, setSalvando] = useState(false);

  const ehAdmin = estado.usuario?.papel === "ADMIN";
  const editavel = notaEditavel(nota.status);
  const rascunho = nota.status === "RASCUNHO";
  const autorizada = nota.status === "AUTORIZADA";
  const emitida = autorizada || nota.status === "CANCELADA";

  // A resposta do sistema nacional pode chegar com a pessoa olhando a tela: avisa quando a nota muda de "enviada".
  const anterior = useRef(nota.status);
  useEffect(() => {
    if (anterior.current === "ENVIADA" && nota.status === "AUTORIZADA") toast.sucesso("Nota emitida");
    if (anterior.current === "ENVIADA" && nota.status === "REJEITADA") toast.erro("O sistema nacional rejeitou a nota. Veja o motivo abaixo.");
    anterior.current = nota.status;
  }, [nota.status, toast]);

  async function executar(acao: () => Promise<unknown>) {
    try {
      await acao();
    } catch (erro) {
      toast.erro(erro instanceof Error ? erro.message : "Não foi possível concluir a ação.");
    }
  }

  const caminho = (tipo: "pdf" | "xml") => `/notas-fiscais/${nota.id}/${tipo}`;
  const baixar = (tipo: "pdf" | "xml") => executar(() => baixarArquivo(caminho(tipo), nomeDoArquivoDaNota(nota, tipo), apiNotasBlob));

  async function copiarChave() {
    try {
      await navigator.clipboard.writeText(nota.chaveAcesso ?? "");
      toast.sucesso("Chave de acesso copiada");
    } catch {
      toast.erro("Não foi possível copiar. Selecione a chave na tela e copie com Ctrl+C.");
    }
  }

  async function confirmarExclusao() {
    try {
      await excluir.mutateAsync(nota.id);
      toast.sucesso(rascunho ? "Rascunho excluído" : "Nota excluída");
      router.replace(hrefLista);
    } catch (erro) {
      setDialogo(null);
      toast.erro(erro instanceof Error ? erro.message : "Não foi possível excluir a nota.");
    }
  }

  // Cabeçalho: no máximo 2 botões visíveis; o resto vai para o menu "⋯" (spec de design, componente "painel de detalhe").
  const itensDoMenu: ItemMenu[] = [];
  if (emitida) {
    itensDoMenu.push({ rotulo: "Abrir o PDF em outra aba", aoSelecionar: () => executar(() => abrirArquivo(caminho("pdf"), apiNotasBlob)) });
    itensDoMenu.push({ rotulo: "Copiar a chave de acesso", aoSelecionar: copiarChave });
  }
  if (emitida || nota.status === "REJEITADA") {
    itensDoMenu.push({ rotulo: "Emitir nota nova com estes dados", aoSelecionar: () => router.push(hrefCopia(nota.id)) });
  }
  if (autorizada) itensDoMenu.push({ rotulo: "Cancelar nota", perigo: true, aoSelecionar: () => setDialogo("cancelar") });
  if (rascunho) itensDoMenu.push({ rotulo: "Excluir rascunho", perigo: true, aoSelecionar: () => setDialogo("excluir") });
  if (nota.status === "REJEITADA") itensDoMenu.push({ rotulo: "Excluir nota rejeitada", perigo: true, aoSelecionar: () => setDialogo("excluir") });

  const mostrarFiscais = nota.numero !== null || nota.chaveAcesso !== null;

  return (
    <div className={MOLDURA}>
      <div className="flex flex-wrap items-start gap-x-2 gap-y-3 border-b border-line p-4">
        <VoltarParaALista href={hrefLista} />
        <div className="min-w-0 flex-1 basis-44">
          <h2 className="truncate font-display text-xl font-semibold">{nota.prestadorNome}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
            <span className="tabular-nums">{formatarDocumento(nota.prestadorDocumento)}</span>
            <StatusDaNota status={nota.status} />
            {nota.ambiente === "HOMOLOGACAO" && nota.status !== "RASCUNHO" && <Pill tom="atencao">Homologação</Pill>}
            {nota.canal === "MUNICIPAL_SALVADOR" && <Pill tom="atencao">Municipal · sem certificado</Pill>}
          </p>
        </div>
        {/* Em tela estreita as ações descem para uma linha própria, em vez de espremer o título. */}
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {editavel && (
            <Button type="submit" form={ID_FORM_NOTA} variante="primario" className="flex-1 sm:flex-none" carregando={salvando}>
              {rascunho ? "Revisar e emitir" : "Revisar e reemitir"}
            </Button>
          )}
          {notaEmProcessamento(nota.status) && (
            <Button className="flex-1 sm:flex-none" carregando={atualizando} onClick={atualizar}>
              Atualizar situação
            </Button>
          )}
          {emitida && (
            <>
              <Button variante={autorizada ? "primario" : "secundario"} className="flex-1 sm:flex-none" onClick={() => baixar("pdf")}>
                Baixar PDF
              </Button>
              <Button className="flex-1 sm:flex-none" onClick={() => baixar("xml")}>
                Baixar XML
              </Button>
            </>
          )}
          <MenuAcoes rotulo="Mais ações da nota" itens={itensDoMenu} />
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4 sm:px-5">
        {notaEmProcessamento(nota.status) && (
          <div role="status" className="flex items-start gap-3 rounded-ui border border-amber/70 bg-amber/10 px-4 py-3">
            <span className="mt-0.5 shrink-0">
              <Spinner tamanho={18} />
            </span>
            <p>
              <strong>Aguardando o sistema nacional.</strong> A nota foi enviada e ainda não tem resposta. Isso costuma levar alguns segundos; a tela se
              atualiza sozinha.
            </p>
          </div>
        )}
        {nota.status === "REJEITADA" && <CaixaDeRejeicao erros={nota.rejeicoes} ehAdmin={ehAdmin} />}
        {nota.canal === "MUNICIPAL_SALVADOR" && (
          <p role="note" className="rounded-ui border border-amber/70 bg-amber/10 px-4 py-3 text-[13px]">
            <strong>Emissão sem certificado.</strong> {AVISO_CANAL_MUNICIPAL}
          </p>
        )}

        <div>
          <p className="font-display text-[34px] font-bold leading-none tabular-nums">{moeda(nota.valor)}</p>
          <p className="mt-2 text-muted">{fraseDaSituacao(nota)}</p>
        </div>
      </div>

      <div className="mt-2 px-4 sm:px-5">
        <Secao titulo="Dados da nota">
          {editavel ? (
            <NotaForm
              nota={nota}
              partida={{ cliente: null, copia: null }}
              onSalvando={setSalvando}
              aoCriar={() => undefined}
            />
          ) : (
            <NotaResumo nota={nota} />
          )}
        </Secao>

        {mostrarFiscais && (
          <Secao titulo="Dados fiscais">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {nota.numero && <Item rotulo="Número da NFS-e">{nota.numero}</Item>}
              <Item rotulo="Ambiente">
                {ROTULO_AMBIENTE[nota.ambiente]}
                {nota.ambiente === "HOMOLOGACAO" && <span className="font-normal text-muted"> · sem validade fiscal</span>}
              </Item>
              {nota.serie !== null && nota.numeroDps !== null && (
                <Item rotulo="Série / número da DPS">
                  <span className="tabular-nums">
                    {nota.serie} / {nota.numeroDps}
                  </span>
                </Item>
              )}
              {nota.emitidaEm && <Item rotulo="Emitida em">{dataHoraBR(nota.emitidaEm)}</Item>}
              {nota.chaveAcesso && (
                <Item rotulo="Chave de acesso" largo>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="break-all tabular-nums">{formatarChaveDeAcesso(nota.chaveAcesso)}</span>
                    <Button pequeno aria-label="Copiar a chave de acesso" onClick={copiarChave}>
                      Copiar
                    </Button>
                  </span>
                </Item>
              )}
            </dl>
          </Secao>
        )}

        {nota.cancelamento && (
          <Secao titulo="Cancelamento">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Item rotulo="Motivo">{rotuloDoMotivo(nota.cancelamento.motivo)}</Item>
              <Item rotulo="Cancelada em">
                {dataHoraBR(nota.cancelamento.canceladaEm)}
                {nota.cancelamento.canceladaPorNome && <span className="font-normal text-muted"> · {nota.cancelamento.canceladaPorNome}</span>}
              </Item>
              <Item rotulo="Justificativa" largo>
                <span className="font-normal">{nota.cancelamento.justificativa}</span>
              </Item>
            </dl>
          </Secao>
        )}

        <Secao titulo="Histórico" resumo={`${nota.historico.length} ${nota.historico.length === 1 ? "registro" : "registros"}`}>
          <LinhaDoTempo eventos={nota.historico} />
        </Secao>
      </div>

      <CancelarDialog aberto={dialogo === "cancelar"} onFechar={() => setDialogo(null)} nota={nota} />

      <Modal
        aberto={dialogo === "excluir"}
        onFechar={() => setDialogo(null)}
        titulo={rascunho ? "Excluir o rascunho?" : "Excluir a nota rejeitada?"}
        largura="sm"
      >
        <p>
          {rascunho ? "O rascunho" : "A nota rejeitada"} de <strong>{nota.prestadorNome}</strong> para {nota.tomadorNome} ({moeda(nota.valor)}) será excluído.{" "}
          {rascunho ? "" : "Ela não gerou nota fiscal, então nada precisa ser cancelado no sistema nacional."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button data-autofocus onClick={() => setDialogo(null)}>
            Voltar
          </Button>
          <Button variante="perigo" carregando={excluir.isPending} onClick={confirmarExclusao}>
            {rascunho ? "Excluir rascunho" : "Excluir nota"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
