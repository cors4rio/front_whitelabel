"use client";

import { useMemo, useState } from "react";

import { Combobox } from "@/components/ui/combobox";
import { buscarMunicipios, leituraDaSituacao, municipioPorIbge, rotuloDoMunicipio } from "@/lib/notas/municipios";

interface Props {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /** Código IBGE (7 dígitos) ou "" enquanto nada foi escolhido. */
  valor: string;
  onChange: (ibge: string) => void;
  desabilitado?: boolean;
}

/**
 * Escolha do município pelo nome (com UF opcional: "santa cruz rn"). Cada opção já diz se o município libera o
 * Emissor Nacional, que é o que decide se dá para emitir por aqui. O código IBGE de 7 dígitos serve de número da opção.
 */
export function MunicipioCombobox({ valor, onChange, desabilitado, ...aria }: Props) {
  const [termo, setTermo] = useState("");
  const opcoes = useMemo(
    () => buscarMunicipios(termo).map((m) => ({ id: Number(m.ibge), rotulo: rotuloDoMunicipio(m), detalhe: leituraDaSituacao(m).titulo })),
    [termo],
  );
  const escolhido = valor ? municipioPorIbge(valor) : null;

  return (
    <Combobox
      {...aria}
      valor={escolhido ? { id: Number(escolhido.ibge), rotulo: rotuloDoMunicipio(escolhido) } : null}
      onChange={(opcao) => onChange(opcao ? String(opcao.id) : "")}
      opcoes={opcoes}
      onBuscar={setTermo}
      rotuloDaLista="Municípios encontrados"
      placeholder="Digite o nome do município"
      textoVazio={termo.trim() ? "Nenhum município com esse nome." : "Digite o nome do município."}
      desabilitado={desabilitado}
    />
  );
}
