"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { documentoValido, formatarDocumento, tipoPessoaDoDocumento } from "@/lib/documento";
import { formatarTelefone } from "@/lib/format";
import { usePlanos, useSalvarCliente } from "@/lib/queries";
import type { Cliente, ClienteInput, StatusCliente } from "@/lib/types";

export const ID_FORM_CLIENTE = "form-cliente";

interface Estado {
  nomeRazaoSocial: string;
  cpfCnpj: string;
  email: string;
  telefone: string;
  planoId: string;
  status: StatusCliente;
  clienteDesde: string;
}

type Erros = Partial<Record<keyof Estado, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function inicial(c: Cliente | null): Estado {
  return {
    nomeRazaoSocial: c?.nomeRazaoSocial ?? "",
    cpfCnpj: formatarDocumento(c?.cpfCnpj),
    email: c?.email ?? "",
    telefone: formatarTelefone(c?.telefone),
    planoId: c?.planoId ? String(c.planoId) : "",
    status: c?.status ?? "ATIVO",
    clienteDesde: c?.clienteDesde ?? "",
  };
}

/** O backend é a autoridade; estas checagens só dão retorno imediato antes de enviar. */
function validar(e: Estado): Erros {
  const erros: Erros = {};
  if (!e.nomeRazaoSocial.trim()) erros.nomeRazaoSocial = "Informe o nome ou a razão social";
  if (!e.cpfCnpj.trim()) erros.cpfCnpj = "Informe o CPF ou CNPJ";
  else if (!documentoValido(e.cpfCnpj)) erros.cpfCnpj = "CPF ou CNPJ inválido";
  if (e.email.trim() && !EMAIL.test(e.email.trim())) erros.email = "E-mail inválido";
  return erros;
}

interface Props {
  /** null = cadastro de um cliente novo. */
  cliente: Cliente | null;
  onSalvando: (salvando: boolean) => void;
  /** Chamado com o id do cliente recém-cadastrado, para a tela abrir o detalhe dele. */
  aoCriar: (id: number) => void;
}

export function ClienteForm({ cliente, onSalvando, aoCriar }: Props) {
  const toast = useToast();
  const { data: planos } = usePlanos();
  const salvar = useSalvarCliente(cliente?.id ?? null);
  const [estado, setEstado] = useState<Estado>(() => inicial(cliente));
  const [erros, setErros] = useState<Erros>({});

  useEffect(() => onSalvando(salvar.isPending), [salvar.isPending, onSalvando]);

  const campo = <K extends keyof Estado>(nome: K, valor: Estado[K]) => {
    setEstado((atual) => ({ ...atual, [nome]: valor }));
    if (erros[nome]) setErros((atual) => ({ ...atual, [nome]: undefined }));
  };

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const encontrados = validar(estado);
    // flushSync: o foco precisa ir para o campo inválido já renderizado com aria-invalid, não antes dele.
    flushSync(() => setErros(encontrados));
    if (Object.keys(encontrados).length > 0) {
      document.getElementById(ID_FORM_CLIENTE)?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    const dados: ClienteInput = {
      nomeRazaoSocial: estado.nomeRazaoSocial.trim(),
      cpfCnpj: estado.cpfCnpj,
      email: estado.email.trim() || null,
      telefone: estado.telefone.trim() || null,
      planoId: estado.planoId ? Number(estado.planoId) : null,
      status: estado.status,
      clienteDesde: estado.clienteDesde || null,
    };
    salvar.mutate(dados, {
      onSuccess: (salvo) => {
        toast.sucesso(cliente ? "Cliente salvo" : "Cliente cadastrado");
        if (!cliente) aoCriar(salvo.id);
      },
      onError: (erro) => {
        if (erro instanceof ApiError && Object.keys(erro.campos).length > 0) {
          setErros(erro.campos as Erros);
        } else if (erro instanceof ApiError && erro.status === 409) {
          setErros({ cpfCnpj: erro.message });
        } else {
          toast.erro(erro instanceof Error ? erro.message : "Não foi possível salvar o cliente.");
        }
      },
    });
  }

  const tipo = tipoPessoaDoDocumento(estado.cpfCnpj);

  return (
    <form id={ID_FORM_CLIENTE} onSubmit={enviar} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
      <Field rotulo="Nome ou razão social" erro={erros.nomeRazaoSocial} className="sm:col-span-2">
        {(a) => (
          <Input
            {...a}
            required
            maxLength={200}
            autoFocus={!cliente}
            value={estado.nomeRazaoSocial}
            onChange={(e) => campo("nomeRazaoSocial", e.target.value)}
          />
        )}
      </Field>

      <Field
        rotulo="CPF ou CNPJ"
        erro={erros.cpfCnpj}
        dica={tipo === "PF" ? "Pessoa física" : tipo === "PJ" ? "Pessoa jurídica" : undefined}
      >
        {(a) => (
          <Input
            {...a}
            required
            inputMode="text"
            autoComplete="off"
            value={estado.cpfCnpj}
            onChange={(e) => campo("cpfCnpj", formatarDocumento(e.target.value))}
          />
        )}
      </Field>

      <Field rotulo="Status">
        {(a) => (
          <Select {...a} value={estado.status} onChange={(e) => campo("status", e.target.value as StatusCliente)}>
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
          </Select>
        )}
      </Field>

      <Field rotulo="E-mail" erro={erros.email}>
        {(a) => (
          <Input
            {...a}
            type="email"
            maxLength={150}
            autoComplete="off"
            value={estado.email}
            onChange={(e) => campo("email", e.target.value)}
          />
        )}
      </Field>

      <Field rotulo="Telefone" erro={erros.telefone}>
        {(a) => (
          <Input
            {...a}
            type="tel"
            maxLength={20}
            autoComplete="off"
            value={estado.telefone}
            onChange={(e) => campo("telefone", e.target.value)}
            onBlur={() => campo("telefone", formatarTelefone(estado.telefone))}
          />
        )}
      </Field>

      <Field rotulo="Plano" dica={planos && planos.length === 0 ? "Nenhum plano cadastrado ainda. Crie em Planos." : undefined}>
        {(a) => (
          <Select {...a} value={estado.planoId} onChange={(e) => campo("planoId", e.target.value)}>
            <option value="">Sem plano</option>
            {planos?.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.ativo && String(p.id) !== estado.planoId}>
                {p.nome}
                {p.ativo ? "" : " (inativo)"}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field rotulo="Cliente desde" erro={erros.clienteDesde}>
        {(a) => (
          <Input {...a} type="date" value={estado.clienteDesde} onChange={(e) => campo("clienteDesde", e.target.value)} />
        )}
      </Field>
    </form>
  );
}
