"use client";

import { useMemo, useState } from "react";

import { Combobox } from "@/components/ui/combobox";
import { buscarServicos, formatarCodigoServico, servicoPorCodigo } from "@/lib/notas/servicos";

interface Props {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /** Código de tributação nacional (6 dígitos) ou "" enquanto nada foi escolhido. */
  valor: string;
  onChange: (codigo: string) => void;
  desabilitado?: boolean;
  /**
   * Restringe a escolha a estes códigos: no canal municipal de Salvador o serviço é uma das atividades que o cliente
   * tem no portal, não a lista nacional inteira.
   */
  somente?: string[];
}

const semAcento = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

/**
 * Escolha do serviço na lista nacional (LC 116/2003, 337 códigos) ou, com {@code somente}, entre as atividades do
 * cliente no portal de Salvador. A busca é local e pega o código, com ou sem pontos, ou palavras da descrição; antes
 * de digitar, aparecem os serviços de um escritório contábil. O {@link Combobox} identifica opções por número: o
 * código de 6 dígitos vira número e volta com os zeros à esquerda.
 */
export function ServicoCombobox({ valor, onChange, desabilitado, somente, ...aria }: Props) {
  const [termo, setTermo] = useState("");
  const opcoes = useMemo(() => {
    const servicos = somente
      ? somente
          .map((codigo) => servicoPorCodigo(codigo))
          .filter((s) => s !== null)
          .filter((s) => {
            const busca = semAcento(termo).replace(/\./g, "").trim();
            return !busca || semAcento(`${s.codigo} ${s.descricao}`).includes(busca);
          })
      : buscarServicos(termo);
    return servicos.map((s) => ({ id: Number(s.codigo), rotulo: `${formatarCodigoServico(s.codigo)} · ${s.descricao}` }));
  }, [termo, somente]);
  const escolhido = servicoPorCodigo(valor);

  return (
    <Combobox
      {...aria}
      valor={escolhido ? { id: Number(escolhido.codigo), rotulo: `${formatarCodigoServico(escolhido.codigo)} · ${escolhido.descricao}` } : null}
      onChange={(opcao) => onChange(opcao ? String(opcao.id).padStart(6, "0") : "")}
      opcoes={opcoes}
      onBuscar={setTermo}
      rotuloDaLista={somente ? "Atividades do cliente no portal de Salvador" : "Serviços da lista nacional"}
      placeholder={somente ? "Escolha uma das atividades do cliente" : "Buscar por código (17.19) ou palavra (contabilidade)"}
      textoVazio={somente ? "O cliente não tem atividade correspondente à busca no portal de Salvador." : "Nenhum serviço da lista nacional corresponde à busca."}
      desabilitado={desabilitado}
    />
  );
}
