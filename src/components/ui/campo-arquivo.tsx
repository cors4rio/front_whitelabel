"use client";

import { useId, useRef } from "react";

import { Button, classesBotao } from "./button";

interface Props {
  /** Atributos de acessibilidade entregues pelo <Field>. */
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  aceita: string;
  arquivo: File | null;
  onChange: (arquivo: File | null) => void;
}

/**
 * Seletor de arquivo para formulários (o envio acontece quando o formulário é enviado). O <input type="file">
 * nativo fica invisível: o texto dele ("Choose File / No file chosen") vem do idioma do navegador, não do
 * sistema. O botão visível é um <label> ligado a ele (abre o seletor ao clicar), e o foco por teclado do input
 * aparece no botão.
 */
export function CampoArquivo({ aceita, arquivo, onChange, id, ...aria }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const idLocal = useId();
  const idCampo = id ?? idLocal;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <input
        ref={entrada}
        id={idCampo}
        type="file"
        accept={aceita}
        {...aria}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="peer sr-only"
      />
      <label
        htmlFor={idCampo}
        className={`${classesBotao("secundario")} cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-text ${
          aria["aria-invalid"] ? "border-crimson" : ""
        }`}
      >
        {arquivo ? "Trocar arquivo" : "Escolher arquivo"}
      </label>
      <span className="min-w-0 flex-1 basis-32 truncate text-[13px] text-muted" title={arquivo?.name}>
        {arquivo ? arquivo.name : "Nenhum arquivo escolhido"}
      </span>
      {arquivo && (
        <Button
          pequeno
          variante="fantasma"
          onClick={() => {
            if (entrada.current) entrada.current.value = "";
            onChange(null);
          }}
        >
          Limpar
        </Button>
      )}
    </div>
  );
}
