"use client";

import { CaretDown, X } from "@phosphor-icons/react";
import { useId, useRef, useState } from "react";

import { Spinner } from "./spinner";

export interface OpcaoCombobox {
  id: number;
  rotulo: string;
  detalhe?: string;
}

interface Props {
  /** Atributos de acessibilidade entregues pelo <Field> (rótulo, erro e dica ligados ao campo). */
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  valor: OpcaoCombobox | null;
  onChange: (opcao: OpcaoCombobox | null) => void;
  /** Resultados da busca atual, já vindos do servidor. */
  opcoes: OpcaoCombobox[];
  carregando?: boolean;
  /** Chamado a cada mudança do texto digitado (quem usa decide o atraso/debounce). */
  onBuscar: (termo: string) => void;
  rotuloDaLista: string;
  placeholder?: string;
  textoVazio?: string;
  desabilitado?: boolean;
}

/**
 * Combobox com lista (padrão WAI-ARIA 1.2): o campo de texto busca; ↑↓ percorre, Enter escolhe, Esc fecha.
 * Escolher exige clicar/Enter numa opção: editar o texto depois de escolher desfaz a escolha, para o campo
 * nunca mostrar um nome diferente do valor realmente selecionado.
 */
export function Combobox({
  valor,
  onChange,
  opcoes,
  carregando = false,
  onBuscar,
  rotuloDaLista,
  placeholder,
  textoVazio = "Nada encontrado.",
  desabilitado = false,
  ...aria
}: Props) {
  const idLista = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState(valor?.rotulo ?? "");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);

  // O texto acompanha o valor escolhido quando ele muda por fora (ex.: carregado do servidor). Ajuste de
  // estado derivado durante a renderização, comparando por conteúdo para não repetir a cada render do pai.
  const chaveDoValor = valor ? `${valor.id}:${valor.rotulo}` : "";
  const [chaveAnterior, setChaveAnterior] = useState(chaveDoValor);
  if (chaveDoValor !== chaveAnterior) {
    setChaveAnterior(chaveDoValor);
    setTexto(valor?.rotulo ?? "");
  }

  const listaVisivel = aberto && opcoes.length > 0;
  const opcaoAtiva = listaVisivel ? Math.min(ativo, opcoes.length - 1) : -1;

  function escolher(opcao: OpcaoCombobox) {
    onChange(opcao);
    setTexto(opcao.rotulo);
    setAberto(false);
  }

  function limpar() {
    onChange(null);
    setTexto("");
    onBuscar("");
    setAberto(true);
    entrada.current?.focus();
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!aberto) setAberto(true);
      else setAtivo(Math.min(opcaoAtiva + 1, opcoes.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo(Math.max(opcaoAtiva - 1, 0));
    } else if (e.key === "Enter" && listaVisivel) {
      e.preventDefault(); // escolher uma opção não pode enviar o formulário
      // Enquanto a busca nova carrega, a lista ainda é a anterior: Enter escolheria um cliente que não é o digitado.
      if (!carregando) escolher(opcoes[opcaoAtiva]);
    } else if (e.key === "Escape" && aberto) {
      e.stopPropagation();
      setAberto(false);
    } else if (e.key === "Tab") {
      setAberto(false);
    }
  }

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setAberto(false);
      }}
    >
      <input
        ref={entrada}
        {...aria}
        role="combobox"
        aria-expanded={listaVisivel}
        aria-controls={listaVisivel ? idLista : undefined}
        aria-autocomplete="list"
        aria-activedescendant={opcaoAtiva >= 0 ? `${idLista}-${opcaoAtiva}` : undefined}
        autoComplete="off"
        disabled={desabilitado}
        placeholder={placeholder}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAberto(true);
          setAtivo(0);
          if (valor) onChange(null);
          onBuscar(e.target.value);
        }}
        onFocus={() => {
          setAberto(true);
          if (valor) onBuscar("");
        }}
        onKeyDown={aoTeclar}
        className="h-10 w-full rounded-ui border border-line bg-paper pl-3 pr-16 text-sm text-fg placeholder:text-muted disabled:opacity-60 aria-[invalid=true]:border-crimson"
      />
      <div className="absolute right-1 top-1 flex items-center">
        {carregando && <Spinner tamanho={16} />}
        {valor && !desabilitado && (
          <button
            type="button"
            onClick={limpar}
            aria-label="Limpar seleção"
            className="grid size-8 place-items-center rounded-ui text-muted hover:bg-line/40"
          >
            <X size={16} weight="bold" aria-hidden />
          </button>
        )}
        {!valor && <CaretDown size={16} weight="bold" className="mr-2 text-muted" aria-hidden />}
      </div>

      {listaVisivel && (
        <ul
          id={idLista}
          role="listbox"
          aria-label={rotuloDaLista}
          aria-busy={carregando}
          className={`absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-ui border border-line bg-paper py-1 shadow-[0_8px_24px_rgba(36,28,26,0.12)] ${carregando ? "opacity-60" : ""}`}
        >
          {opcoes.map((opcao, i) => (
            <li
              key={opcao.id}
              id={`${idLista}-${i}`}
              role="option"
              aria-selected={valor?.id === opcao.id}
              // mouseDown não pode tirar o foco do campo, senão a lista fecharia antes do clique registrar
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => escolher(opcao)}
              onMouseMove={() => setAtivo(i)}
              className={`cursor-pointer px-3 py-2 ${i === opcaoAtiva ? "bg-line/40" : ""}`}
            >
              <span className="block truncate font-medium">{opcao.rotulo}</span>
              {opcao.detalhe && <span className="block truncate text-[13px] text-muted">{opcao.detalhe}</span>}
            </li>
          ))}
        </ul>
      )}
      {aberto && opcoes.length === 0 && (
        <p role="status" className="absolute z-30 mt-1 w-full rounded-ui border border-line bg-paper px-3 py-2 text-muted shadow-[0_8px_24px_rgba(36,28,26,0.12)]">
          {carregando ? "Buscando…" : textoVazio}
        </p>
      )}
    </div>
  );
}
