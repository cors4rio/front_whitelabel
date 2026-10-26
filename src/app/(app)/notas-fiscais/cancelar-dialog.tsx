"use client";

import { useState } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { moeda } from "@/lib/format";
import { useCancelarNota } from "@/lib/notas/queries";
import {
  codigoNaMensagem,
  JUSTIFICATIVA_MAX,
  JUSTIFICATIVA_MIN,
  MOTIVOS_CANCELAMENTO,
  orientacaoParaErro,
  validarCancelamento,
} from "@/lib/notas/regras";
import type { MotivoCancelamento, NotaFiscal } from "@/lib/types";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  nota: NotaFiscal;
}

export function CancelarDialog({ aberto, onFechar, nota }: Props) {
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Cancelar a nota fiscal?">
      {/* O formulário só existe com o diálogo aberto: cada abertura começa limpa. */}
      <FormularioDeCancelamento nota={nota} onFechar={onFechar} />
    </Modal>
  );
}

function FormularioDeCancelamento({ nota, onFechar }: Pick<Props, "nota" | "onFechar">) {
  const toast = useToast();
  const cancelar = useCancelarNota(nota.id);
  const [motivo, setMotivo] = useState<MotivoCancelamento | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [erros, setErros] = useState<{ motivo?: string; justificativa?: string }>({});
  const [recusa, setRecusa] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const encontrados = validarCancelamento(motivo, justificativa);
    // flushSync: o foco precisa ir para o campo inválido já renderizado com aria-invalid, não antes dele.
    flushSync(() => setErros(encontrados));
    setRecusa(null);
    if (Object.keys(encontrados).length > 0) {
      document.querySelector<HTMLElement>("dialog [aria-invalid=true]")?.focus();
      return;
    }
    try {
      await cancelar.mutateAsync({ motivo: motivo!, justificativa: justificativa.trim() });
      toast.sucesso("Nota cancelada");
      onFechar();
    } catch (erro) {
      if (erro instanceof ApiError && Object.keys(erro.campos).length > 0) setErros(erro.campos);
      else setRecusa(erro instanceof Error ? erro.message : "Não foi possível cancelar a nota.");
    }
  }

  const orientacao = recusa ? orientacaoParaErro(codigoNaMensagem(recusa) ?? "") : null;

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <p>
        A NFS-e{nota.numero && <> nº <strong>{nota.numero}</strong></>} de <strong>{nota.prestadorNome}</strong> ({moeda(nota.valor)}) será cancelada no
        sistema nacional. <strong>Isso não pode ser desfeito</strong>: se for preciso, emita uma nota nova. O cancelamento direto só é aceito dentro
        do prazo que o município define.
      </p>

      <Field rotulo="Motivo do cancelamento" erro={erros.motivo}>
        {(a) => (
          <Select
            {...a}
            data-autofocus
            value={motivo ?? ""}
            onChange={(e) => {
              setMotivo(e.target.value ? (Number(e.target.value) as MotivoCancelamento) : null);
              setErros((atual) => ({ ...atual, motivo: undefined }));
            }}
          >
            <option value="">Escolha o motivo</option>
            {MOTIVOS_CANCELAMENTO.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.rotulo}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        rotulo="Justificativa"
        erro={erros.justificativa}
        dica={`De ${JUSTIFICATIVA_MIN} a ${JUSTIFICATIVA_MAX} caracteres. Fica registrada junto com o cancelamento.`}
      >
        {(a) => (
          <Textarea
            {...a}
            rows={3}
            value={justificativa}
            onChange={(e) => {
              setJustificativa(e.target.value);
              setErros((atual) => ({ ...atual, justificativa: undefined }));
            }}
          />
        )}
      </Field>

      {recusa && (
        <div role="alert" className="rounded-ui border border-crimson bg-crimson/5 px-3 py-2.5 text-[13px]">
          <p className="font-semibold text-crimson">O cancelamento foi recusado</p>
          <p className="mt-0.5">{recusa}</p>
          {orientacao && <p className="mt-1 font-medium">{orientacao}</p>}
        </div>
      )}

      {/* Rodapé fixo na base da área rolável: em tela baixa o corpo rola, mas os botões não somem. */}
      <div className="sticky bottom-0 -mx-5 -mb-4 flex flex-wrap justify-end gap-2 border-t border-line bg-paper px-5 py-3">
        <Button onClick={onFechar} disabled={cancelar.isPending}>
          Voltar
        </Button>
        <Button type="submit" variante="perigo" carregando={cancelar.isPending}>
          Cancelar nota
        </Button>
      </div>
    </form>
  );
}
