"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Combobox } from "@/components/ui/combobox";
import { api } from "@/lib/api";
import { formatarDocumento } from "@/lib/documento";
import type { Cliente, Pagina } from "@/lib/types";
import { useAtrasado } from "@/lib/use-atrasado";

export interface ClienteSelecionado {
  id: number;
  nome: string;
}

interface Props {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  valor: ClienteSelecionado | null;
  onChange: (cliente: ClienteSelecionado | null) => void;
  desabilitado?: boolean;
}

/**
 * Escolha de cliente com busca no servidor (nome, CPF/CNPJ ou e-mail). Um <select> não serve: o escritório pode
 * ter centenas de clientes. Reutilizável em Notas Fiscais, Documentos, Tarefas...
 */
export function ClienteCombobox({ valor, onChange, desabilitado, ...aria }: Props) {
  const [termo, setTermo] = useState("");
  const termoAtrasado = useAtrasado(termo.trim(), 200);
  const { data, isFetching } = useQuery({
    queryKey: ["clientes", "pesquisa", termoAtrasado],
    queryFn: () => api<Pagina<Cliente>>(`/clientes?busca=${encodeURIComponent(termoAtrasado)}&size=8`),
    placeholderData: keepPreviousData,
  });

  const opcoes = (data?.content ?? []).map((c) => ({
    id: c.id,
    rotulo: c.nomeRazaoSocial,
    detalhe: [formatarDocumento(c.cpfCnpj), c.status === "INATIVO" ? "Inativo" : null].filter(Boolean).join(" · "),
  }));

  return (
    <Combobox
      {...aria}
      valor={valor ? { id: valor.id, rotulo: valor.nome } : null}
      onChange={(opcao) => onChange(opcao ? { id: opcao.id, nome: opcao.rotulo } : null)}
      opcoes={opcoes}
      // Também conta a espera do debounce: entre digitar e a busca sair, os resultados na tela já estão velhos.
      carregando={isFetching || termo.trim() !== termoAtrasado}
      onBuscar={setTermo}
      rotuloDaLista="Clientes encontrados"
      placeholder="Buscar por nome, CPF/CNPJ ou e-mail"
      textoVazio="Nenhum cliente encontrado."
      desabilitado={desabilitado}
    />
  );
}
