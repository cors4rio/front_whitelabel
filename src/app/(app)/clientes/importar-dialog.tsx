"use client";

import { CheckCircle, DownloadSimple, WarningCircle } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Carregando } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { formatarDocumento } from "@/lib/documento";
import { numero } from "@/lib/format";
import { useImportarClientes } from "@/lib/queries";
import type { ResultadoImportacao } from "@/lib/types";

const MODELO =
  "﻿nome;cpf_cnpj;email;telefone;plano;cliente_desde\n" +
  "Maria da Silva;529.982.247-25;maria@exemplo.com;(11) 91234-5678;Básico;15/03/2024\n";
const MAX_ERROS_VISIVEIS = 50;

function baixarModelo() {
  const url = URL.createObjectURL(new Blob([MODELO], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo-clientes.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportarDialog({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Importar clientes" largura="lg">
      {/* O modal só renderiza o conteúdo aberto, então o estado abaixo recomeça do zero a cada abertura. */}
      <ConteudoImportacao onFechar={onFechar} />
    </Modal>
  );
}

/**
 * Importação em duas etapas: ao escolher o arquivo ele é só verificado (simulação) e o relatório mostra o
 * que entra e o que falha, linha a linha; nada é gravado até o usuário confirmar. Linhas válidas entram
 * mesmo que outras falhem — o usuário corrige e reenvia só o que sobrou.
 */
function ConteudoImportacao({ onFechar }: { onFechar: () => void }) {
  const toast = useToast();
  const importar = useImportarClientes();
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<ResultadoImportacao | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const escolhido = e.target.files?.[0] ?? null;
    setArquivo(escolhido);
    setPrevia(null);
    setErro(null);
    if (!escolhido) return;
    setVerificando(true);
    try {
      setPrevia(await importar.mutateAsync({ arquivo: escolhido, simular: true }));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível ler o arquivo.");
    } finally {
      setVerificando(false);
    }
  }

  async function confirmar() {
    if (!arquivo) return;
    try {
      const r = await importar.mutateAsync({ arquivo, simular: false });
      toast.sucesso(r.importados === 1 ? "1 cliente importado" : `${numero(r.importados)} clientes importados`);
      onFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível importar o arquivo.");
    }
  }

  return (
    <>
      <p className="text-muted">
        Envie um arquivo CSV com as colunas <strong className="text-fg">nome</strong> e{" "}
        <strong className="text-fg">cpf_cnpj</strong> (obrigatórias) e, se quiser, email, telefone, plano e cliente_desde.
        Antes de gravar, o arquivo é verificado e você vê o resultado de cada linha.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={entrada}
          type="file"
          accept=".csv,text/csv"
          aria-label="Arquivo CSV de clientes"
          onChange={escolher}
          className="sr-only"
        />
        <Button data-autofocus onClick={() => entrada.current?.click()}>
          {arquivo ? "Escolher outro arquivo" : "Escolher arquivo CSV"}
        </Button>
        <Button variante="fantasma" onClick={baixarModelo}>
          <DownloadSimple size={18} weight="bold" aria-hidden />
          Baixar modelo
        </Button>
        {arquivo && <span className="min-w-0 truncate text-[13px] text-muted">{arquivo.name}</span>}
      </div>

      {verificando && (
        <div className="mt-5">
          <Carregando texto="Verificando o arquivo…" />
        </div>
      )}

      {erro && (
        <p role="alert" className="mt-5 rounded-ui border border-crimson/40 px-3 py-2 text-crimson">
          {erro}
        </p>
      )}

      {previa && (
        <div className="mt-5" aria-live="polite">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle size={18} weight="bold" className="text-moss" aria-hidden />
              <strong>{numero(previa.importados)}</strong>{" "}
              {previa.importados === 1 ? "pronto para importar" : "prontos para importar"}
            </span>
            {previa.comErro > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <WarningCircle size={18} weight="bold" className="text-crimson" aria-hidden />
                <strong>{numero(previa.comErro)}</strong> {previa.comErro === 1 ? "linha com erro" : "linhas com erro"}
              </span>
            )}
            <span className="text-muted">de {numero(previa.totalLinhas)} no arquivo</span>
          </p>

          {previa.erros.length > 0 && (
            <div className="mt-3 max-h-56 overflow-y-auto rounded-ui border border-line">
              <table className="w-full text-left text-[13px]">
                <thead className="sticky top-0 bg-paper text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Linha</th>
                    <th className="px-3 py-2 font-medium">Documento</th>
                    <th className="px-3 py-2 font-medium">Problema</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.erros.slice(0, MAX_ERROS_VISIVEIS).map((e) => (
                    <tr key={`${e.linha}-${e.mensagem}`} className="border-t border-line align-top">
                      <td className="px-3 py-2 tabular-nums">{e.linha}</td>
                      <td className="px-3 py-2 tabular-nums">{e.documento ? formatarDocumento(e.documento) : "—"}</td>
                      <td className="px-3 py-2">{e.mensagem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previa.erros.length > MAX_ERROS_VISIVEIS && (
                <p className="border-t border-line px-3 py-2 text-muted">
                  e mais {numero(previa.erros.length - MAX_ERROS_VISIVEIS)} linhas com erro.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onFechar}>Cancelar</Button>
        <Button
          variante="primario"
          disabled={!previa || previa.importados === 0}
          carregando={importar.isPending && !verificando}
          onClick={confirmar}
        >
          {previa && previa.importados > 0 ? `Importar ${numero(previa.importados)}` : "Importar"}
        </Button>
      </div>
    </>
  );
}
