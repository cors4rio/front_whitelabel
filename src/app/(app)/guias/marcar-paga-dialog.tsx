"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CampoArquivo } from "@/components/ui/campo-arquivo";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { hojeNoEscritorio, moeda } from "@/lib/format";
import type { Guia } from "@/lib/types";

type AcaoMarcarPaga = UseMutationResult<Guia, Error, { data: string | null; comprovante: File | null }>;

interface Props {
  aberto: boolean;
  onFechar: () => void;
  guia: Guia;
  acao: AcaoMarcarPaga;
}

export function MarcarPagaDialog({ aberto, onFechar, guia, acao }: Props) {
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Marcar como paga" largura="sm">
      {/* O modal só renderiza o conteúdo aberto: a data volta a ser "hoje" e o arquivo some a cada abertura. */}
      <Conteudo onFechar={onFechar} guia={guia} acao={acao} />
    </Modal>
  );
}

function Conteudo({ onFechar, guia, acao }: Omit<Props, "aberto">) {
  const toast = useToast();
  const hoje = hojeNoEscritorio();
  const [data, setData] = useState(hoje);
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [erros, setErros] = useState<{ dataPagamento?: string; comprovante?: string }>({});

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!data) {
      setErros({ dataPagamento: "Informe a data do pagamento" });
      return;
    }
    try {
      await acao.mutateAsync({ data, comprovante });
      toast.sucesso("Pagamento registrado");
      onFechar();
    } catch (erro) {
      if (erro instanceof ApiError && Object.keys(erro.campos).length > 0) setErros(erro.campos);
      else toast.erro(erro instanceof Error ? erro.message : "Não foi possível registrar o pagamento.");
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <p className="text-muted">
        <strong className="text-fg">{guia.descricao}</strong> · {moeda(guia.valor)} · {guia.clienteNome}
      </p>

      <Field rotulo="Data do pagamento" erro={erros.dataPagamento}>
        {(a) => (
          <Input
            {...a}
            type="date"
            required
            max={hoje}
            data-autofocus
            value={data}
            onChange={(e) => {
              setData(e.target.value);
              setErros((atual) => ({ ...atual, dataPagamento: undefined }));
            }}
          />
        )}
      </Field>

      <Field rotulo="Comprovante (opcional)" erro={erros.comprovante} dica="PDF, PNG ou JPG de até 10 MB.">
        {(a) => (
          <CampoArquivo
            {...a}
            aceita="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
            arquivo={comprovante}
            onChange={(f) => {
              setComprovante(f);
              setErros((atual) => ({ ...atual, comprovante: undefined }));
            }}
          />
        )}
      </Field>

      <div className="mt-1 flex justify-end gap-2">
        <Button onClick={onFechar}>Cancelar</Button>
        <Button type="submit" variante="primario" carregando={acao.isPending}>
          Registrar pagamento
        </Button>
      </div>
    </form>
  );
}
