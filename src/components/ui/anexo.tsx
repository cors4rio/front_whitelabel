"use client";

import { FileImage, FilePdf } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { abrirArquivo, baixarArquivo } from "@/lib/arquivos";
import { tamanhoLegivel } from "@/lib/guias";
import type { ArquivoInfo } from "@/lib/types";

import { Button } from "./button";
import { MenuAcoes } from "./menu-acoes";
import { Modal } from "./modal";
import { useToast } from "./toast";

interface Props {
  /** Nome do anexo ("PDF da guia", "Comprovante"): entra nos nomes acessíveis dos botões. */
  titulo: string;
  arquivo: ArquivoInfo | null;
  /** Endereço (relativo a /api/v1) de onde ler o arquivo. */
  caminho: string;
  /** Valor do atributo accept do seletor de arquivo. */
  aceita: string;
  textoAnexar: string;
  textoVazio: string;
  somenteLeitura?: boolean;
  ocupado?: boolean;
  onEnviar: (arquivo: File) => Promise<unknown>;
  onRemover: () => Promise<unknown>;
}

/**
 * Um arquivo anexado a um registro: mostra nome e tamanho, abre/baixa por download autenticado e deixa
 * substituir ou remover. Erros (arquivo que não é PDF, grande demais...) saem como aviso com a explicação do
 * servidor. Remover pede confirmação porque apaga o arquivo de verdade.
 */
export function Anexo({
  titulo,
  arquivo,
  caminho,
  aceita,
  textoAnexar,
  textoVazio,
  somenteLeitura = false,
  ocupado = false,
  onEnviar,
  onRemover,
}: Props) {
  const toast = useToast();
  const entrada = useRef<HTMLInputElement>(null);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);

  async function executar(acao: () => Promise<unknown>) {
    try {
      await acao();
    } catch (erro) {
      toast.erro(erro instanceof Error ? erro.message : "Não foi possível concluir a ação com o arquivo.");
    }
  }

  const Icone = arquivo?.tipo.startsWith("image/") ? FileImage : FilePdf;

  return (
    <div>
      <input
        ref={entrada}
        type="file"
        accept={aceita}
        aria-label={`${titulo}: escolher arquivo`}
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => {
          const escolhido = e.target.files?.[0];
          e.target.value = ""; // permite escolher o mesmo arquivo de novo depois
          if (escolhido) executar(() => onEnviar(escolhido));
        }}
      />

      {arquivo ? (
        <div className="flex flex-wrap items-center gap-3 rounded-ui border border-line p-3">
          <Icone size={28} weight="duotone" className="shrink-0 text-muted" aria-hidden />
          <div className="min-w-0 flex-1 basis-40">
            <p className="truncate font-medium">{arquivo.nome}</p>
            <p className="text-[13px] text-muted">{tamanhoLegivel(arquivo.tamanho)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button pequeno aria-label={`Abrir ${titulo}`} onClick={() => executar(() => abrirArquivo(caminho))}>
              Abrir
            </Button>
            <Button pequeno aria-label={`Baixar ${titulo}`} onClick={() => executar(() => baixarArquivo(caminho, arquivo.nome))}>
              Baixar
            </Button>
            {!somenteLeitura && (
              <MenuAcoes
                rotulo={`Mais ações: ${titulo}`}
                itens={[
                  { rotulo: "Substituir arquivo", aoSelecionar: () => entrada.current?.click() },
                  { rotulo: "Remover arquivo", perigo: true, aoSelecionar: () => setConfirmandoRemocao(true) },
                ]}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-ui border border-dashed border-line p-3">
          <p className="text-muted">{textoVazio}</p>
          {!somenteLeitura && (
            <Button pequeno carregando={ocupado} onClick={() => entrada.current?.click()}>
              {textoAnexar}
            </Button>
          )}
        </div>
      )}

      <Modal aberto={confirmandoRemocao} onFechar={() => setConfirmandoRemocao(false)} titulo="Remover arquivo?" largura="sm">
        <p>
          <strong className="break-all">{arquivo?.nome}</strong> será apagado. Você poderá anexar outro depois.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button data-autofocus onClick={() => setConfirmandoRemocao(false)}>
            Cancelar
          </Button>
          <Button
            variante="perigo"
            carregando={ocupado}
            onClick={async () => {
              await executar(onRemover);
              setConfirmandoRemocao(false);
            }}
          >
            Remover arquivo
          </Button>
        </div>
      </Modal>
    </div>
  );
}
