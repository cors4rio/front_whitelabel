"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

import { ClienteCombobox, type ClienteSelecionado } from "@/components/clientes/cliente-combobox";
import { Button } from "@/components/ui/button";
import { CampoArquivo } from "@/components/ui/campo-arquivo";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { formatarDinheiroCampo, parseDinheiro } from "@/lib/dinheiro";
import { hojeNoEscritorio } from "@/lib/format";
import { ROTULO_TIPO_GUIA, TIPOS_DE_GUIA } from "@/lib/guias";
import { mesesParaFiltro } from "@/lib/notas/regras";
import { useEnviarArquivoDaGuia, useSalvarGuia } from "@/lib/queries-guias";
import type { Guia, GuiaInput, TipoGuia } from "@/lib/types";

export const ID_FORM_GUIA = "form-guia";

interface Estado {
  cliente: ClienteSelecionado | null;
  descricao: string;
  valor: string;
  vencimento: string;
  tipo: TipoGuia;
  /** AAAA-MM ou vazio. */
  competencia: string;
}

type Campo = "cliente" | "descricao" | "valor" | "vencimento" | "arquivo" | "tipo" | "competencia";
type Erros = Partial<Record<Campo, string>>;

const VALOR_MAXIMO = 99_999_999.99;

function inicial(guia: Guia | null, clienteInicial: ClienteSelecionado | null): Estado {
  return {
    cliente: guia ? { id: guia.clienteId, nome: guia.clienteNome } : clienteInicial,
    descricao: guia?.descricao ?? "",
    valor: guia ? formatarDinheiroCampo(guia.valor) : "",
    vencimento: guia?.vencimento ?? "",
    tipo: guia?.tipo ?? "OUTRA",
    competencia: guia?.competencia ?? "",
  };
}

/** O backend é a autoridade; estas checagens só dão retorno imediato antes de enviar. */
function validar(e: Estado): { erros: Erros; valor: number | null } {
  const erros: Erros = {};
  if (!e.cliente) erros.cliente = "Escolha o cliente";
  if (!e.descricao.trim()) erros.descricao = "Informe a descrição";
  const valor = parseDinheiro(e.valor);
  if (valor === null || valor <= 0) erros.valor = "Informe um valor válido, como 1.245,90";
  else if (valor > VALOR_MAXIMO) erros.valor = "O valor é alto demais";
  if (!e.vencimento) erros.vencimento = "Informe a data de vencimento";
  return { erros, valor };
}

/** O servidor chama o cliente de clienteId; a tela, de cliente. */
function errosDoServidor(campos: Record<string, string>): Erros {
  const { clienteId, ...resto } = campos;
  return { ...(resto as Erros), ...(clienteId ? { cliente: clienteId } : {}) };
}

interface Props {
  /** null = cadastro de uma guia nova. */
  guia: Guia | null;
  /** Cliente já escolhido (guia nova aberta a partir de um cliente). */
  clienteInicial?: ClienteSelecionado | null;
  /** Guia paga/cancelada não se edita: reabra primeiro. */
  somenteLeitura?: boolean;
  onSalvando: (salvando: boolean) => void;
  /** Chamado com o id da guia recém-cadastrada, para a tela abrir o detalhe dela. */
  aoCriar: (id: number) => void;
}

export function GuiaForm({ guia, clienteInicial = null, somenteLeitura = false, onSalvando, aoCriar }: Props) {
  const toast = useToast();
  const salvar = useSalvarGuia(guia?.id ?? null);
  const enviarPdf = useEnviarArquivoDaGuia();
  const [estado, setEstado] = useState<Estado>(() => inicial(guia, clienteInicial));
  const [pdf, setPdf] = useState<File | null>(null);
  const [erros, setErros] = useState<Erros>({});

  useEffect(() => onSalvando(salvar.isPending || enviarPdf.isPending), [salvar.isPending, enviarPdf.isPending, onSalvando]);

  const campo = <K extends keyof Estado>(nome: K, valor: Estado[K]) => {
    setEstado((atual) => ({ ...atual, [nome]: valor }));
    if (erros[nome as Campo]) setErros((atual) => ({ ...atual, [nome]: undefined }));
  };

  // Em edição, "Salvar alterações" só liga quando algo mudou em relação ao que está gravado.
  const alterado = guia
    ? estado.cliente?.id !== guia.clienteId ||
      estado.descricao.trim() !== guia.descricao ||
      parseDinheiro(estado.valor) !== guia.valor ||
      estado.vencimento !== guia.vencimento ||
      estado.tipo !== guia.tipo ||
      estado.competencia !== (guia.competencia ?? "")
    : true;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (somenteLeitura) return;
    const { erros: encontrados, valor } = validar(estado);
    // flushSync: o foco precisa ir para o campo inválido já renderizado com aria-invalid, não antes dele.
    flushSync(() => setErros(encontrados));
    if (Object.keys(encontrados).length > 0) {
      document.getElementById(ID_FORM_GUIA)?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    const dados: GuiaInput = {
      clienteId: estado.cliente!.id,
      descricao: estado.descricao.trim(),
      valor: valor!,
      vencimento: estado.vencimento,
      tipo: estado.tipo,
      competencia: estado.competencia || null,
    };

    try {
      const salva = await salvar.mutateAsync(dados);
      if (guia) {
        toast.sucesso("Guia salva");
        return;
      }
      if (pdf) {
        try {
          await enviarPdf.mutateAsync({ id: salva.id, arquivo: pdf });
        } catch (erro) {
          const motivo = erro instanceof Error ? erro.message : "erro desconhecido";
          toast.erro(`A guia foi cadastrada, mas o PDF não foi enviado: ${motivo} Anexe-o no detalhe da guia.`);
        }
      }
      toast.sucesso("Guia cadastrada");
      aoCriar(salva.id);
    } catch (erro) {
      if (erro instanceof ApiError && Object.keys(erro.campos).length > 0) setErros(errosDoServidor(erro.campos));
      else toast.erro(erro instanceof Error ? erro.message : "Não foi possível salvar a guia.");
    }
  }

  return (
    <form id={ID_FORM_GUIA} onSubmit={enviar} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
      {somenteLeitura && (
        <p className="rounded-ui border border-line px-3 py-2 text-muted sm:col-span-2">
          Os dados de uma guia paga ou cancelada não se alteram. Reabra a guia, no menu “⋯”, para editá-los.
        </p>
      )}

      <Field rotulo="Cliente" erro={erros.cliente} className="sm:col-span-2">
        {(a) => (
          <ClienteCombobox {...a} valor={estado.cliente} onChange={(c) => campo("cliente", c)} desabilitado={somenteLeitura} />
        )}
      </Field>

      <Field rotulo="Descrição" erro={erros.descricao} dica={guia ? undefined : "Ex.: DAS 09/2026, FGTS 10/2026"} className="sm:col-span-2">
        {(a) => (
          <Input
            {...a}
            required
            maxLength={150}
            disabled={somenteLeitura}
            value={estado.descricao}
            onChange={(e) => campo("descricao", e.target.value)}
          />
        )}
      </Field>

      <Field rotulo="Tipo da guia" erro={erros.tipo} dica="DAS, DARF e GPS têm estimativa de multa e juros quando vencem.">
        {(a) => (
          <Select {...a} disabled={somenteLeitura} value={estado.tipo} onChange={(e) => campo("tipo", e.target.value as TipoGuia)}>
            {TIPOS_DE_GUIA.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO_GUIA[t]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field rotulo="Competência (opcional)" erro={erros.competencia} dica="O mês a que a guia se refere.">
        {(a) => (
          <Select {...a} disabled={somenteLeitura} value={estado.competencia} onChange={(e) => campo("competencia", e.target.value)}>
            <option value="">Não informada</option>
            {mesesParaFiltro(hojeNoEscritorio(), 24, estado.competencia).map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.rotulo}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field rotulo="Valor (R$)" erro={erros.valor}>
        {(a) => (
          <Input
            {...a}
            required
            inputMode="decimal"
            placeholder="0,00"
            disabled={somenteLeitura}
            value={estado.valor}
            onChange={(e) => campo("valor", e.target.value)}
            onBlur={() => {
              const lido = parseDinheiro(estado.valor);
              if (lido !== null) campo("valor", formatarDinheiroCampo(lido));
            }}
          />
        )}
      </Field>

      <Field rotulo="Vencimento" erro={erros.vencimento}>
        {(a) => (
          <Input
            {...a}
            required
            type="date"
            disabled={somenteLeitura}
            value={estado.vencimento}
            onChange={(e) => campo("vencimento", e.target.value)}
          />
        )}
      </Field>

      {!guia && (
        <Field rotulo="PDF da guia (opcional)" erro={erros.arquivo} dica="Você também pode anexar depois, no detalhe da guia." className="sm:col-span-2">
          {(a) => <CampoArquivo {...a} aceita="application/pdf,.pdf" arquivo={pdf} onChange={setPdf} />}
        </Field>
      )}

      {guia && !somenteLeitura && (
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" carregando={salvar.isPending} disabled={!alterado}>
            Salvar alterações
          </Button>
        </div>
      )}
    </form>
  );
}
