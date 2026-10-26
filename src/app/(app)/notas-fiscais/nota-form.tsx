"use client";

import { Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

import { ClienteCombobox, type ClienteSelecionado } from "@/components/clientes/cliente-combobox";
import { ServicoCombobox } from "@/components/notas/servico-combobox";
import { TomadorCombobox, type TomadorSelecionado } from "@/components/notas/tomador-combobox";
import { TomadorDialog } from "@/components/notas/tomador-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatarDinheiroCampo, parseDinheiro } from "@/lib/dinheiro";
import { formatarDocumento } from "@/lib/documento";
import { hojeNoEscritorio } from "@/lib/format";
import {
  AVISO_CANAL_MUNICIPAL,
  CAMPOS_DE_RETENCAO,
  descricaoMax,
  descricaoPodeSerSugerida,
  descricaoSugerida,
  INFORMACOES_MAX,
  lerRetencoes,
  orientacaoParaErro,
  RETENCOES_VAZIAS,
  ROTULO_RETENCAO,
  validarNota,
  type CampoNotaForm,
  type CampoRetencao,
  type ErrosNota,
} from "@/lib/notas/regras";
import { useConfiguracaoFiscal, useEmitirNota, usePerfil, useSalvarNota } from "@/lib/notas/queries";
import { SERVICO_CONTABIL } from "@/lib/notas/servicos";
import { useCliente } from "@/lib/queries";
import type { CampoNota, CanalDoPerfil, CanalEmissao, NotaFiscal, NotaFiscalInput, PerfilFiscal, RetencoesFederais } from "@/lib/types";

import { EmitirDialog } from "./emitir-dialog";

export const ID_FORM_NOTA = "form-nota";

interface Estado {
  /** Por onde a nota sai. */
  canal: CanalEmissao;
  cliente: ClienteSelecionado | null;
  tomador: TomadorSelecionado | null;
  competencia: string;
  codigoServico: string;
  descricao: string;
  valor: string;
  issRetido: boolean;
  retencoes: Record<CampoRetencao, string>;
  informacoes: string;
}

/** Os dados de partida de uma nota nova (cliente escolhido antes, cópia de outra nota). */
export interface PartidaDaNota {
  cliente: ClienteSelecionado | null;
  /** Nota de que se copiam tomador, serviço, descrição, valor e retenções; a competência recomeça em hoje. */
  copia: NotaFiscal | null;
}

const retencoesEmTexto = (r: RetencoesFederais): Record<CampoRetencao, string> =>
  Object.fromEntries(CAMPOS_DE_RETENCAO.map((c) => [c, r[c] === null ? "" : formatarDinheiroCampo(r[c])])) as Record<CampoRetencao, string>;

function estadoInicial(nota: NotaFiscal | null, partida: PartidaDaNota): Estado {
  const origem = nota ?? partida.copia;
  const clienteDaNota = origem && origem.clienteId !== null ? { id: origem.clienteId, nome: origem.prestadorNome } : null;
  return {
    canal: origem?.canal ?? "NACIONAL",
    cliente: nota ? clienteDaNota : (partida.cliente ?? clienteDaNota),
    tomador: origem && origem.tomadorId !== null ? { id: origem.tomadorId, nome: origem.tomadorNome, documento: origem.tomadorDocumento } : null,
    competencia: nota?.competencia ?? hojeNoEscritorio(),
    codigoServico: origem?.codigoServico ?? SERVICO_CONTABIL,
    descricao: origem?.descricaoServico ?? "",
    valor: origem ? formatarDinheiroCampo(origem.valor) : "",
    issRetido: origem?.issRetido ?? false,
    retencoes: origem ? retencoesEmTexto(origem.retencoes) : { ...RETENCOES_VAZIAS },
    informacoes: origem?.informacoesComplementares ?? "",
  };
}

/** O servidor chama os campos pelo nome da entrada; a tela, pelo nome do campo. */
const CAMPO_DO_SERVIDOR: Record<string, CampoNotaForm> = {
  clienteId: "cliente",
  canal: "cliente",
  tomadorId: "tomador",
  competencia: "competencia",
  codigoServico: "servico",
  descricaoServico: "descricao",
  valor: "valor",
  retencoes: "retencoes",
  informacoesComplementares: "informacoes",
};

function errosDoServidor(campos: Record<string, string>): ErrosNota {
  const erros: ErrosNota = {};
  for (const [nome, mensagem] of Object.entries(campos)) {
    const campo = CAMPO_DO_SERVIDOR[nome];
    if (campo) erros[campo] = mensagem;
  }
  return erros;
}

const CAMPO_DA_REJEICAO: Partial<Record<CampoNota, CampoNotaForm>> = {
  cliente: "cliente",
  tomador: "tomador",
  competencia: "competencia",
  servico: "servico",
  descricao: "descricao",
  valor: "valor",
};

/** Numa nota rejeitada, os campos que o sistema nacional apontou já abrem marcados, com o que fazer. */
function errosDaRejeicao(nota: NotaFiscal | null): ErrosNota {
  const erros: ErrosNota = {};
  for (const r of nota?.rejeicoes ?? []) {
    const campo = r.campo ? CAMPO_DA_REJEICAO[r.campo] : undefined;
    if (campo && !erros[campo]) erros[campo] = `${r.codigo}: ${orientacaoParaErro(r.codigo) ?? r.mensagem}`;
  }
  return erros;
}

/** Foca o primeiro controle do campo dado (a caixa de rejeição usa isto no “Ir para o campo”). */
export function focarCampoDaNota(campo: CampoNota) {
  const alvo = campo === "retencao" ? "retencao" : CAMPO_DA_REJEICAO[campo];
  if (!alvo) return;
  document.querySelector<HTMLElement>(`[data-campo="${alvo}"] :is(input, textarea, select)`)?.focus();
}

interface Props {
  /** null = nota nova. Só rascunho e rejeitada se editam. */
  nota: NotaFiscal | null;
  partida: PartidaDaNota;
  onSalvando: (salvando: boolean) => void;
  /** Chamado com o id da nota recém-criada, para a tela abrir o detalhe dela. */
  aoCriar: (id: number) => void;
}

export function NotaForm({ nota, partida, onSalvando, aoCriar }: Props) {
  const toast = useToast();
  const { estado: sessao } = useAuth();
  const salvar = useSalvarNota(nota?.id ?? null);
  const emitir = useEmitirNota();
  const { data: configuracao } = useConfiguracaoFiscal();
  const hoje = hojeNoEscritorio();
  const [estado, setEstado] = useState<Estado>(() => estadoInicial(nota, partida));
  const [erros, setErros] = useState<ErrosNota>(() => errosDaRejeicao(nota));
  const [revisando, setRevisando] = useState(false);
  const [novoTomador, setNovoTomador] = useState(false);
  const [retencoesAbertas, setRetencoesAbertas] = useState(() => CAMPOS_DE_RETENCAO.some((c) => estadoInicial(nota, partida).retencoes[c] !== ""));
  const [servicoEscolhido, setServicoEscolhido] = useState(nota !== null || partida.copia !== null);
  const [perfilAplicado, setPerfilAplicado] = useState<number | null>(null);
  const [canalEscolhido, setCanalEscolhido] = useState(nota !== null || partida.copia !== null);
  const { data: cliente } = useCliente(estado.cliente?.id ?? null);
  const { data: perfil } = usePerfil(estado.cliente?.id ?? null);

  // O serviço padrão do cliente vale enquanto a pessoa não escolheu outro (ajuste de estado derivado, durante a renderização).
  if (perfil && perfil.clienteId !== perfilAplicado) {
    setPerfilAplicado(perfil.clienteId);
    // O canal padrão do cliente vale enquanto a pessoa não escolheu outro; se o canal da nota não existe para ele, volta ao nacional.
    const disponiveis = perfil.canais.filter((c) => c.disponivel).map((c) => c.canal);
    const canal: CanalEmissao = canalEscolhido && disponiveis.includes(estado.canal) ? estado.canal : disponiveis.includes(perfil.canal) ? perfil.canal : "NACIONAL";
    const atividades = perfil.atividadesMunicipais.map((a) => a.codigoServico);
    setEstado((atual) => ({
      ...atual,
      canal,
      competencia: canal === "MUNICIPAL_SALVADOR" ? hoje : atual.competencia,
      codigoServico:
        canal === "MUNICIPAL_SALVADOR" && !atividades.includes(atual.codigoServico)
          ? (atividades[0] ?? "")
          : !servicoEscolhido && perfil.servicoPadrao
            ? perfil.servicoPadrao
            : atual.codigoServico,
    }));
  }

  const canaisDisponiveis = perfil?.canais.filter((c) => c.disponivel) ?? [];
  const canalAtual = perfil?.canais.find((c) => c.canal === estado.canal);
  const municipal = estado.canal === "MUNICIPAL_SALVADOR";
  const atividadesDoCliente = perfil?.atividadesMunicipais.map((a) => a.codigoServico) ?? [];

  useEffect(() => onSalvando(salvar.isPending || emitir.isPending), [salvar.isPending, emitir.isPending, onSalvando]);

  const apagarErro = (chave: CampoNotaForm) => {
    if (erros[chave]) setErros((atual) => ({ ...atual, [chave]: undefined }));
  };

  const campo = <K extends keyof Estado>(nome: K, valor: Estado[K]) => {
    setEstado((atual) => ({ ...atual, [nome]: valor }));
    // Mexer num campo apaga o erro dele (o do serviço se chama "servico" no erro e "codigoServico" no estado).
    apagarErro((nome === "codigoServico" ? "servico" : nome === "retencoes" ? "retencoes" : nome) as CampoNotaForm);
  };

  /** Trocar de canal muda o que vale: no municipal o serviço é uma atividade do cliente e a data é a do dia. */
  function escolherCanal(canal: CanalEmissao) {
    setCanalEscolhido(true);
    setEstado((atual) => ({
      ...atual,
      canal,
      competencia: canal === "MUNICIPAL_SALVADOR" ? hoje : atual.competencia,
      codigoServico:
        canal === "MUNICIPAL_SALVADOR" && !atividadesDoCliente.includes(atual.codigoServico) ? (atividadesDoCliente[0] ?? "") : atual.codigoServico,
    }));
    setServicoEscolhido(false);
  }

  /** Trocar o prestador troca a lista de tomadores: o tomador escolhido deixa de valer. */
  function escolherCliente(c: ClienteSelecionado | null) {
    setEstado((atual) => ({ ...atual, cliente: c, tomador: c?.id === atual.cliente?.id ? atual.tomador : null }));
    if (c?.id !== estado.cliente?.id) setPerfilAplicado(null);
    apagarErro("cliente");
  }

  const sugestao = descricaoSugerida(estado.competencia);
  const valorLido = parseDinheiro(estado.valor);
  const retencoesLidas = lerRetencoes(estado.retencoes);

  // Em edição, "Salvar alterações" só liga quando algo mudou em relação ao que está gravado.
  const alterado = nota
    ? estado.canal !== nota.canal ||
      estado.cliente?.id !== nota.clienteId ||
      estado.tomador?.id !== nota.tomadorId ||
      estado.competencia !== nota.competencia ||
      estado.codigoServico !== nota.codigoServico ||
      estado.descricao.trim() !== nota.descricaoServico ||
      valorLido !== nota.valor ||
      estado.issRetido !== nota.issRetido ||
      CAMPOS_DE_RETENCAO.some((c) => retencoesLidas[c] !== nota.retencoes[c]) ||
      (estado.informacoes.trim() || null) !== nota.informacoesComplementares
    : true;

  /** Valida; se achar problema, mostra junto de cada campo e leva o foco ao primeiro. Devolve os dados prontos para enviar. */
  function conferir(): NotaFiscalInput | null {
    const { erros: encontrados, valor } = validarNota(estado, hoje);
    if (encontrados.retencoes) setRetencoesAbertas(true);
    // flushSync: o foco precisa ir para o campo inválido já renderizado com aria-invalid, não antes dele.
    flushSync(() => setErros(encontrados));
    if (Object.keys(encontrados).length > 0) {
      document.getElementById(ID_FORM_NOTA)?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return null;
    }
    return {
      canal: estado.canal,
      clienteId: estado.cliente!.id,
      tomadorId: estado.tomador!.id,
      competencia: estado.competencia,
      codigoServico: estado.codigoServico,
      descricaoServico: estado.descricao.trim(),
      valor: valor!,
      issRetido: estado.issRetido,
      retencoes: retencoesLidas,
      informacoesComplementares: estado.informacoes.trim() || null,
    };
  }

  function mostrarErro(erro: unknown, padrao: string) {
    if (erro instanceof ApiError && Object.keys(erro.campos).length > 0) {
      setErros(errosDoServidor(erro.campos));
      toast.erro(erro.message);
    } else {
      toast.erro(erro instanceof Error ? erro.message : padrao);
    }
  }

  async function salvarRascunho() {
    const dados = conferir();
    if (!dados) return;
    try {
      const salva = await salvar.mutateAsync(dados);
      toast.sucesso(nota ? "Alterações salvas" : "Rascunho salvo");
      if (!nota) aoCriar(salva.id);
    } catch (erro) {
      mostrarErro(erro, "Não foi possível salvar a nota.");
    }
  }

  function revisar(e: React.FormEvent) {
    e.preventDefault();
    if (conferir()) setRevisando(true);
  }

  async function confirmarEmissao() {
    const dados = conferir();
    if (!dados) {
      setRevisando(false);
      return;
    }
    let idSalvo = nota?.id ?? null;
    try {
      const salva = nota && !alterado ? nota : await salvar.mutateAsync(dados);
      idSalvo = salva.id;
      const resultado = await emitir.mutateAsync(salva.id);
      setRevisando(false);
      if (resultado.status === "AUTORIZADA") toast.sucesso("Nota emitida");
      else if (resultado.status === "ENVIADA") toast.sucesso("Nota enviada para autorização");
      else toast.erro("A nota foi rejeitada. Veja o motivo e corrija.");
      if (!nota) aoCriar(resultado.id);
    } catch (erro) {
      setRevisando(false);
      // O rascunho já ficou gravado: leva a pessoa até ele em vez de deixá-la com um formulário que não existe mais.
      if (!nota && idSalvo !== null) aoCriar(idSalvo);
      mostrarErro(erro, "Não foi possível emitir a nota.");
    }
  }

  const dicaDoCliente =
    nota && nota.clienteId === null && !estado.cliente
      ? `O cliente desta nota (${nota.prestadorNome}) não está mais no cadastro. Escolha o cliente para continuar.`
      : "É o prestador do serviço: quem emite a nota. O certificado e os dados fiscais são dele.";

  return (
    <>
      <form id={ID_FORM_NOTA} onSubmit={revisar} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <div data-campo="cliente" className="sm:col-span-2">
          <Field rotulo="Cliente (prestador)" erro={erros.cliente} dica={dicaDoCliente}>
            {(a) => <ClienteCombobox {...a} valor={estado.cliente} onChange={escolherCliente} />}
          </Field>
          {estado.cliente && canaisDisponiveis.length > 1 && perfil && (
            <fieldset className="mt-2">
              <legend className="mb-1 text-[13px] font-medium">Emitir por</legend>
              <div className="flex flex-col gap-2 sm:flex-row">
                {canaisDisponiveis.map((c) => (
                  <label key={c.canal} className="flex flex-1 cursor-pointer items-start gap-2 rounded-ui border border-line p-2.5 has-[:checked]:border-accent">
                    <input type="radio" name="canal-da-nota" checked={estado.canal === c.canal} onChange={() => escolherCanal(c.canal)} className="mt-0.5 size-4 shrink-0 accent-accent" />
                    <span>
                      <span className="block font-medium">{c.canal === "NACIONAL" ? "Nacional (certificado)" : "Municipal de Salvador (sem certificado)"}</span>
                      <span className="block text-[13px] text-muted">{c.pronta ? "Pronto" : "Com pendências"}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {estado.cliente && <SituacaoDoPrestador perfil={perfil} canal={canalAtual} documento={cliente?.cpfCnpj} ehAdmin={sessao.usuario?.papel === "ADMIN"} />}
        </div>

        <div data-campo="tomador" className="sm:col-span-2">
          <Field rotulo="Tomador" erro={erros.tomador} dica={estado.tomador ? formatarDocumento(estado.tomador.documento) : "Quem compra o serviço: o nome e o CPF/CNPJ dele saem na nota."}>
            {(a) => (
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <TomadorCombobox {...a} clienteId={estado.cliente?.id ?? null} valor={estado.tomador} onChange={(t) => campo("tomador", t)} />
                </div>
                <Button disabled={!estado.cliente} onClick={() => setNovoTomador(true)}>
                  <Plus size={16} weight="bold" aria-hidden />
                  Novo tomador
                </Button>
              </div>
            )}
          </Field>
        </div>

        <div data-campo="competencia">
          <Field rotulo="Data do serviço (competência)" erro={erros.competencia}>
            {(a) => (
              <Input {...a} required type="date" max={hoje} disabled={municipal} value={estado.competencia} onChange={(e) => campo("competencia", e.target.value)} />
            )}
          </Field>
          {municipal && <p className="mt-1.5 text-[13px] text-muted">No portal de Salvador a data da nota é a do dia da emissão.</p>}
        </div>

        <div data-campo="valor">
          <Field rotulo="Valor do serviço (R$)" erro={erros.valor}>
            {(a) => (
              <Input
                {...a}
                required
                inputMode="decimal"
                placeholder="0,00"
                value={estado.valor}
                onChange={(e) => campo("valor", e.target.value)}
                onBlur={() => {
                  const lido = parseDinheiro(estado.valor);
                  if (lido !== null) campo("valor", formatarDinheiroCampo(lido));
                }}
              />
            )}
          </Field>
        </div>

        <div data-campo="servico" className="sm:col-span-2">
          <Field rotulo="Serviço prestado" erro={erros.servico} dica={municipal ? "Só os serviços que o cliente tem cadastrados no portal de Salvador." : "Código de tributação nacional (lista da LC 116/2003). Contabilidade é 17.19.01."}>
            {(a) => (
              <ServicoCombobox
                {...a}
                somente={municipal ? atividadesDoCliente : undefined}
                valor={estado.codigoServico}
                onChange={(codigo) => {
                  setServicoEscolhido(true);
                  campo("codigoServico", codigo);
                }}
              />
            )}
          </Field>
        </div>

        <div data-campo="descricao" className="sm:col-span-2">
          <Field rotulo="Descrição do serviço" erro={erros.descricao}>
            {(a) => <Textarea {...a} required rows={3} value={estado.descricao} onChange={(e) => campo("descricao", e.target.value)} />}
          </Field>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px] text-muted">
            {descricaoPodeSerSugerida(estado.descricao, sugestao) ? (
              <button type="button" onClick={() => campo("descricao", sugestao)} className="max-w-full truncate text-left font-medium text-accent-text underline underline-offset-2">
                Usar “{sugestao}”
              </button>
            ) : (
              <span />
            )}
            <span className={`tabular-nums ${estado.descricao.length > descricaoMax(estado.canal) ? "font-semibold text-crimson" : ""}`}>
              {estado.descricao.length.toLocaleString("pt-BR")} / {descricaoMax(estado.canal).toLocaleString("pt-BR")}
            </span>
          </div>
        </div>

        <div data-campo="retencao" className="sm:col-span-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-ui border border-line p-3">
            <input type="checkbox" checked={estado.issRetido} onChange={(e) => campo("issRetido", e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-accent" />
            <span>
              <span className="block font-medium">ISS retido pelo tomador</span>
              <span className="block text-[13px] text-muted">Marque só se o tomador vai reter e recolher o ISS desta nota. Fora disso, deixe desmarcado.</span>
            </span>
          </label>
        </div>

        <div data-campo="retencoes" className="sm:col-span-2">
          <details
            open={retencoesAbertas}
            onToggle={(e) => setRetencoesAbertas(e.currentTarget.open)}
            className="rounded-ui border border-line"
          >
            <summary className="cursor-pointer px-3 py-2.5 font-medium">
              Retenções federais (opcional)
              <span className="ml-2 text-[13px] font-normal text-muted">PIS, COFINS, IRRF, CSLL e previdência retidos pelo tomador</span>
            </summary>
            <div className="border-t border-line p-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {CAMPOS_DE_RETENCAO.map((c) => (
                  <Field key={c} rotulo={`${ROTULO_RETENCAO[c]} (R$)`} erro={undefined}>
                    {(a) => (
                      <Input
                        {...a}
                        aria-invalid={erros.retencoes ? true : undefined}
                        aria-describedby={erros.retencoes ? "erro-retencoes" : a["aria-describedby"]}
                        inputMode="decimal"
                        placeholder="0,00"
                        value={estado.retencoes[c]}
                        onChange={(e) => campo("retencoes", { ...estado.retencoes, [c]: e.target.value })}
                        onBlur={() => {
                          const lido = parseDinheiro(estado.retencoes[c]);
                          if (lido !== null) campo("retencoes", { ...estado.retencoes, [c]: formatarDinheiroCampo(lido) });
                        }}
                      />
                    )}
                  </Field>
                ))}
              </div>
              {erros.retencoes && (
                <p id="erro-retencoes" className="mt-2 text-[13px] text-crimson">
                  {erros.retencoes}
                </p>
              )}
              <p className="mt-2 text-[13px] text-muted">Deixe em branco o que não foi retido. Os valores vão na DPS e não podem somar mais que o valor do serviço.</p>
            </div>
          </details>
        </div>

        <div data-campo="informacoes" className="sm:col-span-2">
          <Field
            rotulo="Informações complementares (opcional)"
            erro={erros.informacoes}
            dica={`Aparece na nota. Até ${INFORMACOES_MAX.toLocaleString("pt-BR")} caracteres.`}
          >
            {(a) => <Textarea {...a} rows={2} value={estado.informacoes} onChange={(e) => campo("informacoes", e.target.value)} />}
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <p className="min-w-0 flex-1 basis-60 text-[13px] text-muted">A nota só é enviada depois de você revisar e confirmar.</p>
          <Button carregando={salvar.isPending && !revisando} disabled={!alterado} onClick={salvarRascunho}>
            {nota ? "Salvar alterações" : "Salvar rascunho"}
          </Button>
        </div>

        <EmitirDialog
          aberto={revisando}
          onFechar={() => setRevisando(false)}
          emitindo={salvar.isPending || emitir.isPending}
          onConfirmar={confirmarEmissao}
          perfil={perfil}
          canal={canalAtual}
          ambiente={configuracao?.ambiente}
          resumo={{
            prestador: estado.cliente?.nome ?? "",
            prestadorDocumento: cliente?.cpfCnpj ?? "",
            tomador: estado.tomador?.nome ?? "",
            tomadorDocumento: estado.tomador?.documento ?? "",
            competencia: estado.competencia,
            codigoServico: estado.codigoServico,
            descricao: estado.descricao.trim(),
            valor: valorLido ?? 0,
            issRetido: estado.issRetido,
            retencoes: retencoesLidas,
          }}
          reemissao={nota?.status === "REJEITADA"}
        />
      </form>

      {estado.cliente && (
        <TomadorDialog
          aberto={novoTomador}
          onFechar={() => setNovoTomador(false)}
          clienteId={estado.cliente.id}
          tomador={null}
          onSalvo={(t) => campo("tomador", { id: t.id, nome: t.nome, documento: t.documento })}
        />
      )}
    </>
  );
}

/** O que a pessoa precisa saber do prestador antes de preencher o resto: se ele está pronto por este canal e como emite. */
function SituacaoDoPrestador({
  perfil,
  canal,
  documento,
  ehAdmin,
}: {
  perfil: PerfilFiscal | undefined;
  canal: CanalDoPerfil | undefined;
  documento: string | undefined;
  ehAdmin: boolean;
}) {
  if (!perfil || !canal) return null;
  const link = ehAdmin ? (
    <Link href={`/notas-fiscais/configuracao?cliente=${perfil.clienteId}`} className="font-medium text-accent-text underline underline-offset-2">
      Abrir os dados fiscais de {perfil.clienteNome}
    </Link>
  ) : (
    <span className="text-muted">Peça a um administrador para completar os dados fiscais deste cliente.</span>
  );
  const pendencias = canal.prontidao.filter((i) => i.situacao === "PENDENTE");

  if (!canal.pronta) {
    return (
      <div role="status" className="mt-2 rounded-ui border border-crimson bg-crimson/5 px-3 py-2.5 text-[13px]">
        <p className="font-semibold text-crimson">Este cliente ainda não está pronto para emitir</p>
        <ul className="mt-1 list-disc pl-5">
          {pendencias.map((p) => (
            <li key={p.id}>{p.detalhe}</li>
          ))}
        </ul>
        <p className="mt-1.5">
          Você pode salvar a nota como rascunho e emitir depois. {link}.
        </p>
      </div>
    );
  }
  if (canal.canal === "MUNICIPAL_SALVADOR") {
    return (
      <p role="status" className="mt-2 rounded-ui border border-amber/70 bg-amber/10 px-3 py-2.5 text-[13px]">
        <strong>Emissão sem certificado.</strong> {AVISO_CANAL_MUNICIPAL}
      </p>
    );
  }
  return (
    <p className="mt-1.5 text-[13px] text-muted">
      <span className="tabular-nums">{formatarDocumento(documento)}</span> · emite com certificado digital · {perfil.municipioNome}/{perfil.uf}
    </p>
  );
}
