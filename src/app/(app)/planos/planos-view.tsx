"use client";

import { PencilSimple, Plus, Receipt } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Pill } from "@/components/ui/pill";
import { Carregando } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatarDinheiroCampo, parseDinheiro } from "@/lib/dinheiro";
import { moeda } from "@/lib/format";
import { usePlanos, useSalvarPlano } from "@/lib/queries";
import type { Plano } from "@/lib/types";

/** Catálogo de planos e serviços. Todos leem; só o ADMIN cria e edita (a API também impõe isso). */
export function PlanosView() {
  const { estado } = useAuth();
  const ehAdmin = estado.usuario?.papel === "ADMIN";
  const { data: planos, isPending, isError, refetch } = usePlanos();
  const [editando, setEditando] = useState<Plano | "novo" | null>(null);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[25px] font-semibold sm:text-[32px]">Planos</h1>
        {ehAdmin && (
          <Button variante={planos && planos.length > 0 ? "primario" : "secundario"} onClick={() => setEditando("novo")}>
            <Plus size={18} weight="bold" aria-hidden />
            Novo plano
          </Button>
        )}
      </header>
      <p className="mt-1 text-muted">Os planos que você oferece aos clientes. O valor entra na receita mensal prevista do Painel.</p>

      <div className="mt-5 rounded-ui border border-line bg-paper">
        {isPending && (
          <div className="p-6">
            <Carregando texto="Carregando planos…" />
          </div>
        )}
        {isError && (
          <div className="p-6">
            <p className="text-crimson">Não foi possível carregar os planos.</p>
            <Button className="mt-3" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          </div>
        )}
        {planos && planos.length === 0 && (
          <EmptyState
            icone={<Receipt size={40} weight="duotone" aria-hidden />}
            titulo="Nenhum plano cadastrado"
            texto={
              ehAdmin
                ? "Cadastre os planos que você oferece para poder vinculá-los aos clientes."
                : "Peça a um administrador para cadastrar os planos."
            }
          >
            {ehAdmin && (
              <Button variante="primario" onClick={() => setEditando("novo")}>
                <Plus size={18} weight="bold" aria-hidden />
                Novo plano
              </Button>
            )}
          </EmptyState>
        )}
        {planos && planos.length > 0 && (
          <ul className="divide-y divide-line">
            {planos.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.nome}</p>
                  {p.descricao && <p className="truncate text-[13px] text-muted">{p.descricao}</p>}
                </div>
                <span className="font-semibold tabular-nums">{moeda(p.valor)}</span>
                <Pill tom={p.ativo ? "ok" : "neutro"}>{p.ativo ? "Ativo" : "Inativo"}</Pill>
                {ehAdmin && (
                  <Button pequeno aria-label={`Editar plano ${p.nome}`} onClick={() => setEditando(p)}>
                    <PencilSimple size={16} weight="bold" aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        aberto={editando !== null}
        onFechar={() => setEditando(null)}
        titulo={editando === "novo" ? "Novo plano" : "Editar plano"}
        largura="sm"
      >
        {editando !== null && <FormPlano plano={editando === "novo" ? null : editando} onConcluir={() => setEditando(null)} />}
      </Modal>
    </div>
  );
}

function FormPlano({ plano, onConcluir }: { plano: Plano | null; onConcluir: () => void }) {
  const toast = useToast();
  const salvar = useSalvarPlano(plano?.id ?? null);
  const [nome, setNome] = useState(plano?.nome ?? "");
  const [valor, setValor] = useState(plano ? formatarDinheiroCampo(plano.valor) : "");
  const [descricao, setDescricao] = useState(plano?.descricao ?? "");
  const [ativo, setAtivo] = useState(plano?.ativo ?? true);
  const [erros, setErros] = useState<{ nome?: string; valor?: string }>({});

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    // parseDinheiro entende "199,90", "1.234,56" e "199.90" (colado de planilha) sem multiplicar por mil:
    // o parser antigo apagava todos os pontos e transformava 199.90 em 19990.
    const lido = parseDinheiro(valor);
    const novos: typeof erros = {};
    if (!nome.trim()) novos.nome = "Informe o nome do plano";
    if (lido === null) novos.valor = "Informe um valor válido, como 199,90 (no máximo 2 casas decimais)";
    setErros(novos);
    if (lido === null || Object.keys(novos).length > 0) return;

    salvar.mutate(
      { nome: nome.trim(), valor: lido, descricao: descricao.trim() || null, ativo },
      {
        onSuccess: () => {
          toast.sucesso(plano ? "Plano salvo" : "Plano cadastrado");
          onConcluir();
        },
        onError: (erro) => {
          if (erro instanceof ApiError && erro.status === 409) setErros({ nome: erro.message });
          else toast.erro(erro instanceof Error ? erro.message : "Não foi possível salvar o plano.");
        },
      },
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <Field rotulo="Nome" erro={erros.nome}>
        {(a) => <Input {...a} required data-autofocus maxLength={100} value={nome} onChange={(e) => setNome(e.target.value)} />}
      </Field>
      <Field rotulo="Valor mensal (R$)" erro={erros.valor}>
        {(a) => <Input {...a} required inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />}
      </Field>
      <Field rotulo="Descrição (opcional)">
        {(a) => <Input {...a} maxLength={1000} value={descricao} onChange={(e) => setDescricao(e.target.value)} />}
      </Field>
      <Field rotulo="Status">
        {(a) => (
          <Select {...a} value={ativo ? "1" : "0"} onChange={(e) => setAtivo(e.target.value === "1")}>
            <option value="1">Ativo</option>
            <option value="0">Inativo</option>
          </Select>
        )}
      </Field>
      <div className="mt-1 flex justify-end gap-2">
        <Button onClick={onConcluir}>Cancelar</Button>
        <Button type="submit" variante="primario" carregando={salvar.isPending}>
          {plano ? "Salvar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}
