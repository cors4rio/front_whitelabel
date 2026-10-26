"use client";

import { useState } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { formatarDocumento } from "@/lib/documento";
import { useSalvarTomador } from "@/lib/notas/queries";
import { validarTomador } from "@/lib/notas/regras";
import type { Tomador } from "@/lib/types";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  /** O cliente dono da lista. */
  clienteId: number;
  /** Tomador a editar; null = novo. */
  tomador: Tomador | null;
  onSalvo: (tomador: Tomador) => void;
}

/** Cadastro rápido de um tomador na lista de um cliente (CPF/CNPJ, nome e e-mail). */
export function TomadorDialog({ aberto, onFechar, clienteId, tomador, onSalvo }: Props) {
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo={tomador ? "Editar tomador" : "Novo tomador"} largura="sm">
      {/* O formulário só existe com o diálogo aberto: cada abertura começa limpa. */}
      <Formulario clienteId={clienteId} tomador={tomador} onFechar={onFechar} onSalvo={onSalvo} />
    </Modal>
  );
}

type Erros = { documento?: string; nome?: string; email?: string };

function Formulario({ clienteId, tomador, onFechar, onSalvo }: Omit<Props, "aberto">) {
  const toast = useToast();
  const salvar = useSalvarTomador(clienteId, tomador?.id ?? null);
  const [documento, setDocumento] = useState(formatarDocumento(tomador?.documento));
  const [nome, setNome] = useState(tomador?.nome ?? "");
  const [email, setEmail] = useState(tomador?.email ?? "");
  const [erros, setErros] = useState<Erros>({});

  const limpar = (campo: keyof Erros) => setErros((atual) => ({ ...atual, [campo]: undefined }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation(); // o diálogo pode estar dentro de outro formulário
    const encontrados = validarTomador({ documento, nome, email });
    // flushSync: o foco precisa ir para o campo inválido já renderizado com aria-invalid, não antes dele.
    flushSync(() => setErros(encontrados));
    if (Object.keys(encontrados).length > 0) {
      document.querySelector<HTMLElement>("dialog [aria-invalid=true]")?.focus();
      return;
    }
    try {
      const salvo = await salvar.mutateAsync({ documento, nome: nome.trim(), email: email.trim() || null });
      toast.sucesso(tomador ? "Tomador salvo" : "Tomador cadastrado");
      onSalvo(salvo);
      onFechar();
    } catch (erro) {
      if (erro instanceof ApiError && Object.keys(erro.campos).length > 0) setErros(erro.campos);
      else toast.erro(erro instanceof Error ? erro.message : "Não foi possível salvar o tomador.");
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <Field rotulo="CPF ou CNPJ" erro={erros.documento}>
        {(a) => (
          <Input
            {...a}
            data-autofocus
            required
            autoComplete="off"
            value={documento}
            onChange={(e) => {
              setDocumento(e.target.value);
              limpar("documento");
            }}
            onBlur={() => setDocumento(formatarDocumento(documento))}
          />
        )}
      </Field>
      <Field rotulo="Nome ou razão social" erro={erros.nome}>
        {(a) => (
          <Input
            {...a}
            required
            autoComplete="off"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              limpar("nome");
            }}
          />
        )}
      </Field>
      <Field rotulo="E-mail (opcional)" erro={erros.email} dica="Sai na nota; é para onde o tomador recebe o PDF, quando o envio por e-mail existir.">
        {(a) => (
          <Input
            {...a}
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              limpar("email");
            }}
          />
        )}
      </Field>
      <div className="sticky bottom-0 -mx-5 -mb-4 flex flex-wrap justify-end gap-2 border-t border-line bg-paper px-5 py-3">
        <Button onClick={onFechar} disabled={salvar.isPending}>
          Cancelar
        </Button>
        <Button type="submit" variante="primario" carregando={salvar.isPending}>
          {tomador ? "Salvar tomador" : "Cadastrar tomador"}
        </Button>
      </div>
    </form>
  );
}
