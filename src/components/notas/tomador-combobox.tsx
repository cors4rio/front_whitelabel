"use client";

import { useState } from "react";

import { Combobox } from "@/components/ui/combobox";
import { formatarDocumento } from "@/lib/documento";
import { useTomadores } from "@/lib/notas/queries";
import { useAtrasado } from "@/lib/use-atrasado";

export interface TomadorSelecionado {
  id: number;
  nome: string;
  documento: string;
}

interface Props {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /** O cliente que emite (prestador): a lista de tomadores é dele. Sem cliente escolhido, o campo espera. */
  clienteId: number | null;
  valor: TomadorSelecionado | null;
  onChange: (tomador: TomadorSelecionado | null) => void;
}

/** Escolha do tomador entre os que já compraram do cliente (busca por nome ou CPF/CNPJ). Tomador novo: pelo botão ao lado. */
export function TomadorCombobox({ clienteId, valor, onChange, ...aria }: Props) {
  const [termo, setTermo] = useState("");
  const termoAtrasado = useAtrasado(termo.trim(), 200);
  const { data, isFetching } = useTomadores(clienteId, termoAtrasado);

  const opcoes = (data?.content ?? []).map((t) => ({ id: t.id, rotulo: t.nome, detalhe: formatarDocumento(t.documento) }));

  return (
    <Combobox
      {...aria}
      valor={valor ? { id: valor.id, rotulo: valor.nome } : null}
      onChange={(opcao) => onChange(opcao ? { id: opcao.id, nome: opcao.rotulo, documento: data?.content.find((t) => t.id === opcao.id)?.documento ?? "" } : null)}
      opcoes={opcoes}
      carregando={isFetching || termo.trim() !== termoAtrasado}
      onBuscar={setTermo}
      rotuloDaLista="Tomadores encontrados"
      placeholder={clienteId === null ? "Escolha primeiro o cliente" : "Buscar por nome ou CPF/CNPJ"}
      textoVazio={clienteId !== null && !termo.trim() ? "Este cliente ainda não tem tomadores. Use “Novo tomador”." : "Nenhum tomador encontrado."}
      desabilitado={clienteId === null}
    />
  );
}
