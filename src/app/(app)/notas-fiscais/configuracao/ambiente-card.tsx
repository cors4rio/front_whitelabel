"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useSalvarConfiguracao } from "@/lib/notas/queries";
import { ROTULO_AMBIENTE } from "@/lib/notas/regras";
import type { AmbienteNfse } from "@/lib/types";

const OPCOES: { valor: AmbienteNfse; texto: string }[] = [
  { valor: "HOMOLOGACAO", texto: "As notas são de teste e não têm validade fiscal. Use para conferir o cadastro de cada cliente sem risco." },
  { valor: "PRODUCAO", texto: "As notas têm validade fiscal e geram obrigações para o cliente. Só depois de testar." },
];

/**
 * O ambiente vale para o escritório todo (todos os clientes emitem no mesmo). Passar para produção pede confirmação:
 * dali em diante cada nota emitida vale de verdade.
 */
export function AmbienteCard({ ambiente, somenteLeitura }: { ambiente: AmbienteNfse; somenteLeitura: boolean }) {
  const toast = useToast();
  const salvar = useSalvarConfiguracao();
  const [confirmando, setConfirmando] = useState(false);

  async function trocar(novo: AmbienteNfse) {
    try {
      await salvar.mutateAsync({ ambiente: novo });
      toast.sucesso(`Ambiente: ${ROTULO_AMBIENTE[novo].toLowerCase()}`);
    } catch (erro) {
      toast.erro(erro instanceof Error ? erro.message : "Não foi possível trocar o ambiente.");
    } finally {
      setConfirmando(false);
    }
  }

  function escolher(valor: AmbienteNfse) {
    if (valor === ambiente) return;
    if (valor === "PRODUCAO") setConfirmando(true);
    else void trocar(valor);
  }

  return (
    <section aria-labelledby="titulo-ambiente" className="rounded-ui border border-line bg-paper p-4">
      <h2 id="titulo-ambiente" className="font-display text-base font-semibold">
        Ambiente de emissão
      </h2>
      <p className="mt-0.5 text-[13px] text-muted">Vale para todos os clientes. Trocar de ambiente pede um novo teste de conexão em cada um.</p>
      <fieldset className="mt-3 flex flex-col gap-2 sm:flex-row" disabled={somenteLeitura || salvar.isPending}>
        <legend className="sr-only">Ambiente de emissão</legend>
        {OPCOES.map((o) => (
          <label key={o.valor} className="flex flex-1 cursor-pointer items-start gap-3 rounded-ui border border-line p-3 has-[:checked]:border-accent has-[:disabled]:cursor-default has-[:disabled]:opacity-60">
            <input type="radio" name="ambiente" value={o.valor} checked={ambiente === o.valor} onChange={() => escolher(o.valor)} className="mt-0.5 size-4 shrink-0 accent-accent" />
            <span>
              <span className="block font-medium">{ROTULO_AMBIENTE[o.valor]}</span>
              <span className="block text-[13px] text-muted">{o.texto}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Modal aberto={confirmando} onFechar={() => setConfirmando(false)} titulo="Passar para produção?" largura="sm">
        <p>
          A partir de agora, <strong>cada nota emitida tem validade fiscal</strong> e não pode ser desfeita sem cancelamento no prazo do município. Cada cliente precisará de um
          novo teste de conexão.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button data-autofocus onClick={() => setConfirmando(false)}>
            Continuar em homologação
          </Button>
          <Button variante="primario" carregando={salvar.isPending} onClick={() => trocar("PRODUCAO")}>
            Passar para produção
          </Button>
        </div>
      </Modal>
    </section>
  );
}
