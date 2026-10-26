// A simulação do módulo de Notas Fiscais: responde, dentro do navegador, às mesmas rotas e com os mesmos formatos
// que o backend vai ter (ver README, seção "Backend e contrato da API"). Quando o backend existir, esta
// pasta inteira sai e a tela não muda. Por isso aqui valem as regras de verdade da NFS-e Nacional (códigos de
// erro e textos do Anexo I), não atalhos que só funcionariam em demonstração.

import { ApiError, type Opcoes } from "../../api.ts";
import { normalizarDocumento } from "../../documento.ts";
import type {
  CancelamentoInput,
  CanalEmissao,
  ConfiguracaoFiscal,
  ErroFiscal,
  FiltroPerfil,
  Financeiro,
  FiltroStatusNota,
  GuiaDoPortal,
  LinhaFinanceira,
  LoteConsulta,
  MovimentoPortal,
  NotaFiscal,
  NotaFiscalInput,
  NotaFiscalResumo,
  Pagina,
  PerfilFiscal,
  PerfilFiscalInput,
  PerfilFiscalResumo,
  PortalInput,
  RegimeEspecial,
  ResultadoTesteConexao,
  Tomador,
  TomadorInput,
} from "../../types.ts";
import { leituraDaSituacao, municipioPorIbge } from "../municipios.ts";
import { CAMPOS_DE_RETENCAO, descricaoMax, INFORMACOES_MAX, JUSTIFICATIVA_MAX, JUSTIFICATIVA_MIN, SALVADOR_IBGE, totalRetido, VALOR_MAXIMO, validarTomador } from "../regras.ts";
import { descricaoDoServico, servicoPorCodigo } from "../servicos.ts";
import type { Armazenamento } from "./armazenamento.ts";
import {
  ALIQUOTA_ISS_DEMO,
  ATIVIDADES_DEMO,
  bancoInicial,
  calcularProntidao,
  CONEXOES_VAZIAS,
  perfilPublico,
  somarDias,
  type Banco,
  type ClienteBasico,
  type NotaGuardada,
  type PerfilGuardado,
} from "./banco.ts";
import { gerarPdfMinimo, gerarXmlDemo, linhasDoDanfse } from "./documentos.ts";

export type { ClienteBasico };

export interface DependenciasDoServidor {
  armazenamento: Armazenamento;
  agora: () => Date;
  /** AAAA-MM-DD no fuso do escritório. */
  hoje: () => string;
  /** Tempo até uma nota enviada ser autorizada ou rejeitada (pelo portal leva o triplo). */
  atrasoMs: () => number;
  /** Espera artificial por chamada, para a tela mostrar o carregamento como mostraria com a rede de verdade. */
  latenciaMs?: number;
  buscarCliente: (id: number) => Promise<ClienteBasico | null>;
  /** O financeiro de verdade (guias), que vive no backend mesmo na demonstração; a simulação põe nele o que o "portal" emitiu. */
  financeiroDasGuias: (mes: string) => Promise<Financeiro>;
  listarClientes: (filtro: { busca: string; tamanho: number }) => Promise<ClienteBasico[]>;
  nomeDoUsuario: () => Promise<string | null>;
}

/** Resposta interna: o corpo (ou o erro) e o status que o backend devolveria. */
interface Resposta {
  status: number;
  json?: unknown;
  blob?: Blob;
}

/** Recusa de negócio ou de validação: vira um erro HTTP com mensagem em português, como o ProblemDetail do backend. */
class Recusa extends Error {
  readonly status: number;
  readonly campos: Record<string, string>;

  constructor(status: number, mensagem: string, campos: Record<string, string> = {}) {
    super(mensagem);
    this.status = status;
    this.campos = campos;
  }
}

const DIA_MS = 86_400_000;
/** Convênio do município de demonstração: competências anteriores são recusadas (regra E1270 do Anexo I). */
export const INICIO_DO_CONVENIO_DEMO = "2025-05-01";
/** Prazo de cancelamento direto do município de demonstração; passado dele, só com análise fiscal (E0822). */
export const PRAZO_DE_CANCELAMENTO_DIAS = 30;
export const TAMANHO_DA_PAGINA = 20;
/** Pelo canal municipal a resposta demora mais (navegador, captcha): a simulação multiplica a espera por isto. */
export const FATOR_DO_CANAL_MUNICIPAL = 3;

const REGIMES: RegimeEspecial[] = [
  "NENHUM",
  "ATO_COOPERADO",
  "ESTIMATIVA",
  "MICROEMPRESA_MUNICIPAL",
  "NOTARIO_REGISTRADOR",
  "PROFISSIONAL_AUTONOMO",
  "SOCIEDADE_PROFISSIONAIS",
  "OUTROS",
];

const semAcento = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

const publica = ({ resolverEm: _resolverEm, ...nota }: NotaGuardada): NotaFiscal => {
  void _resolverEm;
  return nota;
};

export function resumir(n: NotaFiscal): NotaFiscalResumo {
  return {
    id: n.id,
    clienteId: n.clienteId,
    prestadorNome: n.prestadorNome,
    prestadorDocumento: n.prestadorDocumento,
    tomadorNome: n.tomadorNome,
    tomadorDocumento: n.tomadorDocumento,
    descricaoServico: n.descricaoServico,
    valor: n.valor,
    competencia: n.competencia,
    numero: n.numero,
    status: n.status,
    ambiente: n.ambiente,
    canal: n.canal,
    emitidaEm: n.emitidaEm,
    createdAt: n.createdAt,
  };
}

export interface FiltrosDaLista {
  busca: string;
  situacao: FiltroStatusNota;
  clienteId: number | null;
  /** AAAA-MM da competência. */
  mes: string;
}

/**
 * Mais recentes primeiro. A busca olha prestador e tomador (nome e documento), o número e a descrição; várias
 * palavras valem em qualquer ordem ("oliveira andrade" acha "Oliveira & Andrade Ltda").
 */
export function filtrarNotas(notas: NotaGuardada[], f: FiltrosDaLista): NotaGuardada[] {
  const termo = semAcento(f.busca).trim();
  const palavras = termo.split(/\s+/).filter(Boolean);
  const digitos = termo.replace(/\D/g, "");
  return notas
    .filter((n) => f.situacao === "TODAS" || n.status === f.situacao)
    .filter((n) => f.clienteId === null || n.clienteId === f.clienteId)
    .filter((n) => !f.mes || n.competencia.startsWith(f.mes))
    .filter((n) => {
      if (palavras.length === 0) return true;
      const texto = semAcento(`${n.prestadorNome} ${n.tomadorNome} ${n.descricaoServico}`);
      if (palavras.every((p) => texto.includes(p))) return true;
      if (n.numero !== null && n.numero === termo) return true;
      return digitos.length >= 3 && (normalizarDocumento(n.prestadorDocumento).includes(digitos) || normalizarDocumento(n.tomadorDocumento).includes(digitos));
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
}

/**
 * O que o sistema nacional recusaria nesta nota. Só as regras que a simulação sabe reproduzir; as mensagens são as
 * oficiais (Anexo I, aba "RN DPS_NFS-e"), com o código. Pelo portal ainda existe o captcha, que o robô pode não vencer.
 */
export function analisarNota(nota: NotaFiscal, perfil: Pick<PerfilGuardado, "regimeEspecial" | "opcaoSimples">): ErroFiscal[] {
  const erros: ErroFiscal[] = [];
  const nacional = nota.canal === "NACIONAL";
  if (nota.canal === "MUNICIPAL_SALVADOR" && /captcha/i.test(nota.descricaoServico)) {
    erros.push({ codigo: "PORTAL01", mensagem: "O portal pediu uma verificação (captcha) que não foi resolvida. Tente emitir de novo.", campo: null });
  }
  if (nacional && nota.competencia < INICIO_DO_CONVENIO_DEMO) {
    erros.push({
      codigo: "E1270",
      mensagem: "A data de competência deve ser igual ou posterior à data de ativação do convênio do município emissor informado na DPS.",
      campo: "competencia",
    });
  }
  if (nacional && nota.codigoServico.startsWith("14")) {
    erros.push({
      codigo: "E0312",
      mensagem: "O código de tributação nacional informado não está administrado pelo município de incidência do ISSQN na data de competência informada na DPS.",
      campo: "servico",
    });
  }
  if (nota.issRetido && perfil.opcaoSimples === "MEI") {
    erros.push({
      codigo: "E0583",
      mensagem: "Não é permitido retenção do ISSQN para o prestador do serviço que seja MEI na data de competência informada na DPS.",
      campo: "retencao",
    });
  }
  if (nota.issRetido && perfil.regimeEspecial !== "NENHUM") {
    erros.push({
      codigo: "E0588",
      mensagem: "Não é permitido retenção do ISSQN para o prestador do serviço que tenha algum regime especial de tributação na data de competência informada na DPS.",
      campo: "retencao",
    });
  }
  return erros;
}

function chaveDeAcesso(ibge: string, ambiente: NotaFiscal["ambiente"], documento: string, numero: string, em: Date, id: number): string {
  const base = `${ibge}${ambiente === "PRODUCAO" ? 1 : 2}${documento.length === 11 ? 1 : 2}${documento.padStart(14, "0")}${numero.padStart(13, "0")}${String(em.getUTCFullYear()).slice(2)}${String(em.getUTCMonth() + 1).padStart(2, "0")}${String(id).padStart(9, "0")}`;
  return `${base}${[...base].reduce((soma, d) => soma + (/\d/.test(d) ? Number(d) : 0), 0) % 10}`;
}

/** Quanto, nas guias deste movimento, o portal mostrou como quitado. */
function quitadoDe(m: MovimentoPortal): number {
  return m.guias.filter((g) => g.situacao === "QUITADA").reduce((soma, g) => soma + (g.valor ?? 0), 0);
}

/** "2026-10" + (-1) = "2026-09" */
function somarMeses(mes: string, delta: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const indice = ano * 12 + (m - 1) + delta;
  return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, "0")}`;
}

const ABREVIACAO_DO_MES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export class ServidorDemo {
  private readonly dep: DependenciasDoServidor;

  constructor(dependencias: DependenciasDoServidor) {
    this.dep = dependencias;
  }

  /** Chama uma rota como o `api()` chamaria: devolve o JSON (undefined em 204) ou lança {@link ApiError}. */
  async chamar<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
    return (await this.responder(caminho, opcoes)).json as T;
  }

  async chamarBlob(caminho: string): Promise<Blob> {
    const resposta = await this.responder(caminho, {});
    if (!resposta.blob) throw new ApiError(404, "Arquivo não encontrado.");
    return resposta.blob;
  }

  /** Volta ao estado de partida (notas de exemplo; sem perfis nem tomadores). */
  reiniciar(): void {
    this.dep.armazenamento.limpar();
  }

  private async responder(caminho: string, opcoes: Opcoes): Promise<Resposta> {
    if (this.dep.latenciaMs) await new Promise((resolve) => setTimeout(resolve, this.dep.latenciaMs));
    const metodo = (opcoes.method ?? "GET").toUpperCase();
    const formulario = opcoes.body instanceof FormData ? opcoes.body : undefined;
    try {
      return await this.processar(metodo, caminho, opcoes.json, formulario);
    } catch (erro) {
      if (erro instanceof Recusa) throw new ApiError(erro.status, erro.message, erro.campos);
      throw erro;
    }
  }

  // ── Estado ─────────────────────────────────────────────────────────────────────────────────

  private carregar(): Banco {
    let banco = this.dep.armazenamento.ler();
    if (!banco) {
      banco = bancoInicial(this.dep.agora(), this.dep.hoje());
      this.dep.armazenamento.gravar(banco);
    }
    this.avancarTempo(banco);
    return banco;
  }

  private gravar(banco: Banco): void {
    this.dep.armazenamento.gravar(banco);
  }

  /** Resolve as notas enviadas cujo tempo de espera acabou. Não há timer: o tempo avança quando alguém pergunta. */
  private avancarTempo(banco: Banco): void {
    const agora = this.dep.agora().getTime();
    let mudou = false;
    for (const nota of banco.notas) {
      if (nota.status === "ENVIADA" && nota.resolverEm !== null && nota.resolverEm <= agora) {
        this.resolver(banco, nota);
        mudou = true;
      }
    }
    if (this.avancarLote(banco)) mudou = true;
    if (mudou) this.gravar(banco);
  }

  private resolver(banco: Banco, nota: NotaGuardada): void {
    const instante = new Date(nota.resolverEm ?? this.dep.agora().getTime());
    const perfil = banco.perfis.find((p) => p.clienteId === nota.clienteId);
    const erros = perfil ? analisarNota(nota, perfil) : [];
    nota.resolverEm = null;
    if (erros.length > 0) {
      nota.status = "REJEITADA";
      nota.rejeicoes = erros;
      nota.historico.push({ tipo: "REJEITADA", em: instante.toISOString(), por: null, detalhe: erros.map((e) => e.codigo).join(", ") });
      return;
    }
    const numero = String(banco.proximoNumeroNfse++);
    const semIss = perfil?.opcaoSimples === "ME_EPP" || perfil?.opcaoSimples === "MEI";
    nota.status = "AUTORIZADA";
    nota.rejeicoes = [];
    nota.numero = numero;
    nota.emitidaEm = instante.toISOString();
    nota.chaveAcesso = chaveDeAcesso(perfil?.municipioIbge ?? "0000000", nota.ambiente, nota.prestadorDocumento, numero, instante, nota.id);
    nota.aliquotaIss = semIss ? null : ALIQUOTA_ISS_DEMO;
    nota.valorIss = semIss ? null : Math.round(nota.valor * ALIQUOTA_ISS_DEMO) / 100;
    nota.temXml = true;
    nota.temPdf = true;
    nota.historico.push({ tipo: "AUTORIZADA", em: instante.toISOString(), por: null, detalhe: `NFS-e nº ${numero}` });
  }

  // ── Roteamento ─────────────────────────────────────────────────────────────────────────────

  private async processar(metodo: string, caminho: string, json: unknown, formulario: FormData | undefined): Promise<Resposta> {
    const [rota, consultaTexto = ""] = caminho.split("?");
    const consulta = new URLSearchParams(consultaTexto);
    const partes = rota.split("/").filter(Boolean);
    const ehId = (texto: string | undefined) => texto !== undefined && /^\d+$/.test(texto);

    if (partes[0] === "notas-fiscais") {
      if (partes.length === 1 && metodo === "GET") return this.listar(consulta);
      if (partes.length === 1 && metodo === "POST") return this.criar(json as NotaFiscalInput);
      if (ehId(partes[1])) {
        const id = Number(partes[1]);
        if (partes.length === 2 && metodo === "GET") return this.detalhar(id);
        if (partes.length === 2 && metodo === "PUT") return this.atualizar(id, json as NotaFiscalInput);
        if (partes.length === 2 && metodo === "DELETE") return this.excluir(id);
        if (partes.length === 3 && partes[2] === "emitir" && metodo === "POST") return this.emitir(id);
        if (partes.length === 3 && partes[2] === "cancelar" && metodo === "POST") return this.cancelar(id, json as CancelamentoInput);
        if (partes.length === 3 && (partes[2] === "xml" || partes[2] === "pdf") && metodo === "GET") return this.arquivo(id, partes[2]);
      }
    }
    if (partes[0] === "configuracao-fiscal") {
      if (partes.length === 1 && metodo === "GET") return { status: 200, json: this.configuracao(this.carregar()) };
      if (partes.length === 1 && metodo === "PUT") return this.salvarConfiguracao(json as ConfiguracaoFiscal);
    }
    if (partes[0] === "perfis-fiscais") {
      if (partes.length === 1 && metodo === "GET") return this.listarPerfis(consulta);
      if (ehId(partes[1])) {
        const clienteId = Number(partes[1]);
        if (partes.length === 2 && metodo === "GET") return this.lerPerfil(clienteId);
        if (partes.length === 2 && metodo === "PUT") return this.salvarPerfil(clienteId, json as PerfilFiscalInput);
        if (partes[2] === "certificado" && metodo === "PUT") return this.enviarCertificado(clienteId, formulario);
        if (partes[2] === "certificado" && metodo === "DELETE") return this.removerCredencial(clienteId, "certificado");
        if (partes[2] === "portal" && metodo === "PUT") return this.salvarPortal(clienteId, json as PortalInput);
        if (partes[2] === "portal" && metodo === "DELETE") return this.removerCredencial(clienteId, "portal");
        if (partes[2] === "testar-conexao" && metodo === "POST") return this.testarConexao(clienteId, consulta.get("canal"));
        if (partes[2] === "movimentos-portal" && partes.length === 3 && metodo === "GET") return this.listarMovimentos(clienteId);
        if (partes[2] === "movimentos-portal" && partes.length === 3 && metodo === "POST") return this.consultarMovimento(clienteId, json as { competencia: string });
        if (partes[2] === "tomadores" && partes.length === 3 && metodo === "GET") return this.listarTomadores(clienteId, consulta);
        if (partes[2] === "tomadores" && partes.length === 3 && metodo === "POST") return this.criarTomador(clienteId, json as TomadorInput);
      }
    }
    if (partes[0] === "tomadores" && ehId(partes[1]) && partes.length === 2) {
      if (metodo === "PUT") return this.atualizarTomador(Number(partes[1]), json as TomadorInput);
      if (metodo === "DELETE") return this.excluirTomador(Number(partes[1]));
    }
    if (partes[0] === "financeiro" && partes.length === 1 && metodo === "GET") return this.financeiro(consulta.get("mes") ?? "");
    if (partes[0] === "movimentos-portal" && partes[1] === "lote") {
      if (partes.length === 2 && metodo === "GET") return this.loteAtual();
      if (partes.length === 2 && metodo === "POST") return this.iniciarLote(json as { competencia: string; somenteFaltantes?: boolean });
      if (partes.length === 3 && partes[2] === "cancelar" && metodo === "POST") return this.cancelarLote();
    }
    if (partes[0] === "demo" && partes[1] === "reiniciar" && metodo === "POST") {
      this.reiniciar();
      return { status: 204 };
    }
    throw new Recusa(404, "Rota não encontrada.");
  }

  private achar(banco: Banco, id: number): NotaGuardada {
    const nota = banco.notas.find((n) => n.id === id);
    if (!nota) throw new Recusa(404, "Nota fiscal não encontrada.");
    return nota;
  }

  private async clienteOu404(id: number): Promise<ClienteBasico> {
    const cliente = await this.dep.buscarCliente(id);
    if (!cliente) throw new Recusa(404, "Cliente não encontrado.");
    return cliente;
  }

  // ── Notas ──────────────────────────────────────────────────────────────────────────────────

  private listar(consulta: URLSearchParams): Resposta {
    const banco = this.carregar();
    const situacao = (consulta.get("situacao") ?? "TODAS") as FiltroStatusNota;
    const clienteId = consulta.get("clienteId");
    const todas = filtrarNotas(banco.notas, {
      busca: consulta.get("busca") ?? "",
      situacao,
      clienteId: clienteId && /^\d+$/.test(clienteId) ? Number(clienteId) : null,
      mes: consulta.get("mes") ?? "",
    });
    const tamanho = Math.min(Math.max(Number(consulta.get("size")) || TAMANHO_DA_PAGINA, 1), 100);
    const pagina = Math.max(Number(consulta.get("page")) || 0, 0);
    const conteudo = todas.slice(pagina * tamanho, (pagina + 1) * tamanho).map((n) => resumir(publica(n)));
    const corpo: Pagina<NotaFiscalResumo> = {
      content: conteudo,
      page: pagina,
      size: tamanho,
      totalElements: todas.length,
      totalPages: Math.ceil(todas.length / tamanho),
    };
    return { status: 200, json: corpo };
  }

  private detalhar(id: number): Resposta {
    return { status: 200, json: publica(this.achar(this.carregar(), id)) };
  }

  private async validarEntrada(entrada: NotaFiscalInput): Promise<{ prestador: ClienteBasico; tomador: Tomador }> {
    const campos: Record<string, string> = {};
    const prestador = Number.isInteger(entrada?.clienteId) ? await this.dep.buscarCliente(entrada.clienteId) : null;
    if (!Number.isInteger(entrada?.clienteId)) campos.clienteId = "Escolha o cliente que emite a nota.";
    else if (!prestador) campos.clienteId = "Cliente não encontrado.";

    const tomador = this.carregar().tomadores.find((t) => t.id === entrada?.tomadorId) ?? null;
    if (!Number.isInteger(entrada?.tomadorId)) campos.tomadorId = "Escolha o tomador do serviço.";
    else if (!tomador || tomador.clienteId !== entrada.clienteId) campos.tomadorId = "Tomador não encontrado na lista deste cliente.";

    if (!entrada?.competencia) campos.competencia = "Informe a data de competência.";
    else if (entrada.competencia > this.dep.hoje()) campos.competencia = "A competência não pode ser posterior à data de hoje.";

    if (!entrada?.codigoServico) campos.codigoServico = "Informe o código de tributação nacional.";
    else if (!servicoPorCodigo(entrada.codigoServico)) campos.codigoServico = "Esse código não existe na lista nacional de serviços.";

    const canalValido = entrada?.canal === "NACIONAL" || entrada?.canal === "MUNICIPAL_SALVADOR";
    if (!canalValido) campos.canal = "Escolha por onde a nota sai.";
    else if (prestador && entrada.canal === "MUNICIPAL_SALVADOR") {
      const perfil = this.carregar().perfis.find((p) => p.clienteId === prestador.id);
      if (!perfil || perfil.municipioIbge !== SALVADOR_IBGE) campos.canal = "O canal municipal só existe para clientes de Salvador.";
      else if (!campos.codigoServico && !perfil.atividades.some((a) => a.codigoServico === entrada.codigoServico)) {
        campos.codigoServico = "Esse serviço não está entre as atividades do cliente no portal de Salvador.";
      }
    }

    const limite = descricaoMax(canalValido ? entrada.canal : "NACIONAL");
    const descricao = entrada?.descricaoServico?.trim() ?? "";
    if (!descricao) campos.descricaoServico = "Informe a descrição do serviço.";
    else if (descricao.length > limite) campos.descricaoServico = `Use no máximo ${limite} caracteres.`;

    if (typeof entrada?.valor !== "number" || !(entrada.valor > 0)) campos.valor = "Informe um valor maior que zero.";
    else if (entrada.valor > VALOR_MAXIMO) campos.valor = "O valor é alto demais.";

    const r = entrada?.retencoes;
    if (!r || CAMPOS_DE_RETENCAO.some((c) => r[c] !== null && (typeof r[c] !== "number" || r[c]! < 0))) campos.retencoes = "Informe as retenções como valores positivos (ou deixe em branco).";
    else if (typeof entrada.valor === "number" && totalRetido(r) > entrada.valor) campos.retencoes = "A soma das retenções não pode passar do valor do serviço.";

    if ((entrada?.informacoesComplementares?.length ?? 0) > INFORMACOES_MAX) {
      campos.informacoesComplementares = `Use no máximo ${INFORMACOES_MAX} caracteres.`;
    }
    if (Object.keys(campos).length > 0) throw new Recusa(400, "Há campos para corrigir. Revise-os e tente de novo.", campos);
    return { prestador: prestador!, tomador: tomador! };
  }

  private aplicarEntrada(banco: Banco, nota: NotaGuardada, entrada: NotaFiscalInput, prestador: ClienteBasico, tomador: Tomador): void {
    nota.clienteId = prestador.id;
    nota.prestadorNome = prestador.nome;
    nota.prestadorDocumento = prestador.documento;
    nota.tomadorId = tomador.id;
    nota.tomadorNome = tomador.nome;
    nota.tomadorDocumento = tomador.documento;
    nota.tomadorEmail = tomador.email;
    nota.canal = entrada.canal;
    nota.competencia = entrada.competencia;
    nota.codigoServico = entrada.codigoServico;
    nota.descricaoServico = entrada.descricaoServico.trim();
    nota.valor = entrada.valor;
    nota.issRetido = entrada.issRetido;
    nota.retencoes = { ...entrada.retencoes };
    nota.informacoesComplementares = entrada.informacoesComplementares?.trim() || null;
  }

  private async criar(entrada: NotaFiscalInput): Promise<Resposta> {
    const { prestador, tomador } = await this.validarEntrada(entrada);
    const por = await this.dep.nomeDoUsuario();
    const banco = this.carregar();
    const agora = this.dep.agora().toISOString();
    const nota: NotaGuardada = {
      id: banco.proximoId++,
      clienteId: prestador.id,
      prestadorNome: "",
      prestadorDocumento: "",
      tomadorId: tomador.id,
      tomadorNome: "",
      tomadorDocumento: "",
      tomadorEmail: null,
      descricaoServico: "",
      codigoServico: "",
      valor: 0,
      competencia: "",
      issRetido: false,
      retencoes: { irrf: null, csll: null, pis: null, cofins: null, previdencia: null },
      informacoesComplementares: null,
      numero: null,
      status: "RASCUNHO",
      ambiente: banco.ambiente,
      canal: "NACIONAL",
      emitidaEm: null,
      createdAt: agora,
      serie: null,
      numeroDps: null,
      chaveAcesso: null,
      aliquotaIss: null,
      valorIss: null,
      rejeicoes: [],
      cancelamento: null,
      historico: [{ tipo: "RASCUNHO_CRIADO", em: agora, por, detalhe: null }],
      temXml: false,
      temPdf: false,
      resolverEm: null,
    };
    this.aplicarEntrada(banco, nota, entrada, prestador, tomador);
    banco.notas.push(nota);
    this.gravar(banco);
    return { status: 201, json: publica(nota) };
  }

  private async atualizar(id: number, entrada: NotaFiscalInput): Promise<Resposta> {
    const { prestador, tomador } = await this.validarEntrada(entrada);
    const por = await this.dep.nomeDoUsuario();
    const banco = this.carregar();
    const nota = this.achar(banco, id);
    if (nota.status !== "RASCUNHO" && nota.status !== "REJEITADA") {
      throw new Recusa(409, "Só rascunhos e notas rejeitadas podem ser alterados. Uma nota já enviada ou autorizada não muda.");
    }
    this.aplicarEntrada(banco, nota, entrada, prestador, tomador);
    nota.historico.push({ tipo: "EDITADA", em: this.dep.agora().toISOString(), por, detalhe: null });
    this.gravar(banco);
    return { status: 200, json: publica(nota) };
  }

  private excluir(id: number): Resposta {
    const banco = this.carregar();
    const nota = this.achar(banco, id);
    // Rascunho e rejeitada nunca viraram nota fiscal (a rejeitada não gerou NFS-e): podem ser descartadas.
    if (nota.status !== "RASCUNHO" && nota.status !== "REJEITADA") {
      throw new Recusa(409, "Só rascunhos e notas rejeitadas podem ser excluídos. Para desfazer uma nota já emitida, cancele-a.");
    }
    banco.notas = banco.notas.filter((n) => n.id !== id);
    this.gravar(banco);
    return { status: 204 };
  }

  private async emitir(id: number): Promise<Resposta> {
    const por = await this.dep.nomeDoUsuario();
    const banco = this.carregar();
    const nota = this.achar(banco, id);
    if (nota.status !== "RASCUNHO" && nota.status !== "REJEITADA") {
      throw new Recusa(409, "Esta nota já foi enviada para autorização.");
    }
    const cliente = nota.clienteId === null ? null : await this.dep.buscarCliente(nota.clienteId);
    if (!cliente) throw new Recusa(409, "O cliente desta nota não está mais no cadastro. Escolha o cliente, salve a nota e emita de novo.");
    const perfil = banco.perfis.find((p) => p.clienteId === cliente.id) ?? null;
    const { prontidao, pronta } = calcularProntidao(perfil, cliente, this.dep.hoje(), nota.canal);
    if (!pronta || !perfil) {
      const impedimento = prontidao.find((i) => i.situacao === "PENDENTE");
      throw new Recusa(409, `A emissão de ${cliente.nome} ainda não está pronta: ${impedimento?.detalhe ?? "revise os dados fiscais dele."}`);
    }
    const agora = this.dep.agora();
    nota.status = "ENVIADA";
    nota.ambiente = banco.ambiente;
    nota.serie = perfil.serieDps;
    nota.numeroDps = perfil.proximoNumeroDps++;
    nota.rejeicoes = [];
    nota.resolverEm = agora.getTime() + this.dep.atrasoMs() * (nota.canal === "MUNICIPAL_SALVADOR" ? FATOR_DO_CANAL_MUNICIPAL : 1);
    nota.historico.push({ tipo: "ENVIADA", em: agora.toISOString(), por, detalhe: null });
    this.gravar(banco);
    // Com espera zero a resposta já traz o desfecho, como na API síncrona do sistema nacional.
    this.avancarTempo(banco);
    return { status: 200, json: publica(nota) };
  }

  private async cancelar(id: number, entrada: CancelamentoInput): Promise<Resposta> {
    const por = await this.dep.nomeDoUsuario();
    const banco = this.carregar();
    const nota = this.achar(banco, id);
    if (nota.status !== "AUTORIZADA") throw new Recusa(409, "Só uma nota autorizada pode ser cancelada.");

    const campos: Record<string, string> = {};
    if (![1, 2, 9].includes(entrada?.motivo)) campos.motivo = "Escolha o motivo do cancelamento.";
    const justificativa = entrada?.justificativa?.trim() ?? "";
    if (justificativa.length < JUSTIFICATIVA_MIN) campos.justificativa = `Explique o motivo com pelo menos ${JUSTIFICATIVA_MIN} caracteres.`;
    else if (justificativa.length > JUSTIFICATIVA_MAX) campos.justificativa = `Use no máximo ${JUSTIFICATIVA_MAX} caracteres.`;
    if (Object.keys(campos).length > 0) throw new Recusa(400, "Há campos para corrigir. Revise-os e tente de novo.", campos);

    const agora = this.dep.agora();
    const idade = (agora.getTime() - new Date(nota.emitidaEm ?? agora).getTime()) / DIA_MS;
    if (idade > PRAZO_DE_CANCELAMENTO_DIAS) {
      throw new Recusa(422, "E0822: O prazo para o cancelamento da NFS-e expirou, conforme parametrização do município emissor da NFS-e.");
    }

    nota.status = "CANCELADA";
    nota.cancelamento = { motivo: entrada.motivo, justificativa, canceladaEm: agora.toISOString(), canceladaPorNome: por };
    nota.historico.push({
      tipo: "CANCELADA",
      em: agora.toISOString(),
      por,
      detalhe: entrada.motivo === 1 ? "Erro na emissão" : entrada.motivo === 2 ? "Serviço não prestado" : "Outros",
    });
    this.gravar(banco);
    return { status: 200, json: publica(nota) };
  }

  private arquivo(id: number, tipo: "xml" | "pdf"): Resposta {
    const banco = this.carregar();
    const nota = publica(this.achar(banco, id));
    if (!(tipo === "xml" ? nota.temXml : nota.temPdf)) {
      throw new Recusa(404, "Esta nota ainda não tem esse arquivo: ele existe só depois de autorizada.");
    }
    if (tipo === "xml") {
      const perfil = banco.perfis.find((p) => p.clienteId === nota.clienteId) ?? null;
      return { status: 200, blob: new Blob([gerarXmlDemo(nota, perfil)], { type: "application/xml" }) };
    }
    return { status: 200, blob: new Blob([gerarPdfMinimo(linhasDoDanfse(nota)) as BlobPart], { type: "application/pdf" }) };
  }

  // ── Configuração do escritório ─────────────────────────────────────────────────────────────

  private configuracao(banco: Banco): ConfiguracaoFiscal {
    return { ambiente: banco.ambiente };
  }

  private salvarConfiguracao(entrada: ConfiguracaoFiscal): Resposta {
    if (entrada?.ambiente !== "HOMOLOGACAO" && entrada?.ambiente !== "PRODUCAO") {
      throw new Recusa(400, "Há campos para corrigir. Revise-os e tente de novo.", { ambiente: "Escolha o ambiente." });
    }
    const banco = this.carregar();
    banco.ambiente = entrada.ambiente;
    for (const p of banco.perfis) p.conexoes = { ...CONEXOES_VAZIAS }; // outro ambiente, outra conexão: cada cliente testa de novo
    this.gravar(banco);
    return { status: 200, json: this.configuracao(banco) };
  }

  // ── Dados fiscais por cliente ──────────────────────────────────────────────────────────────

  private resumoDoPerfil(perfil: PerfilFiscal): PerfilFiscalResumo {
    return {
      clienteId: perfil.clienteId,
      clienteNome: perfil.clienteNome,
      clienteDocumento: perfil.clienteDocumento,
      configurado: perfil.configurado,
      municipioNome: perfil.municipioNome,
      uf: perfil.uf,
      canal: perfil.canal,
      pronta: perfil.pronta,
    };
  }

  private async listarPerfis(consulta: URLSearchParams): Promise<Resposta> {
    const banco = this.carregar();
    const clientes = await this.dep.listarClientes({ busca: consulta.get("busca") ?? "", tamanho: 100 });
    const filtro = (consulta.get("situacao") ?? "TODOS") as FiltroPerfil;
    const hoje = this.dep.hoje();
    const todos = clientes
      .map((c) => this.resumoDoPerfil(perfilPublico(banco.perfis.find((p) => p.clienteId === c.id) ?? null, c, hoje)))
      .filter((r) => filtro === "TODOS" || (filtro === "PRONTOS" ? r.pronta : filtro === "PENDENTES" ? r.configurado && !r.pronta : !r.configurado));
    const tamanho = Math.min(Math.max(Number(consulta.get("size")) || TAMANHO_DA_PAGINA, 1), 100);
    const pagina = Math.max(Number(consulta.get("page")) || 0, 0);
    const corpo: Pagina<PerfilFiscalResumo> = {
      content: todos.slice(pagina * tamanho, (pagina + 1) * tamanho),
      page: pagina,
      size: tamanho,
      totalElements: todos.length,
      totalPages: Math.ceil(todos.length / tamanho),
    };
    return { status: 200, json: corpo };
  }

  private async lerPerfil(clienteId: number): Promise<Resposta> {
    const cliente = await this.clienteOu404(clienteId);
    const banco = this.carregar();
    return { status: 200, json: perfilPublico(banco.perfis.find((p) => p.clienteId === clienteId) ?? null, cliente, this.dep.hoje()) };
  }

  private async salvarPerfil(clienteId: number, entrada: PerfilFiscalInput): Promise<Resposta> {
    const cliente = await this.clienteOu404(clienteId);
    const campos: Record<string, string> = {};
    if ((entrada?.inscricaoMunicipal?.length ?? 0) > 15) campos.inscricaoMunicipal = "Use no máximo 15 caracteres.";
    if (!entrada?.municipioIbge || !municipioPorIbge(entrada.municipioIbge)) campos.municipioIbge = "Escolha o município na lista.";
    if (!["NAO_OPTANTE", "ME_EPP", "MEI"].includes(entrada?.opcaoSimples)) campos.opcaoSimples = "Escolha o regime tributário.";
    if (!REGIMES.includes(entrada?.regimeEspecial)) campos.regimeEspecial = "Escolha uma das opções.";
    if (entrada?.canal !== "NACIONAL" && entrada?.canal !== "MUNICIPAL_SALVADOR") campos.canal = "Escolha por onde este cliente emite.";
    else if (entrada.canal === "MUNICIPAL_SALVADOR" && entrada.municipioIbge !== SALVADOR_IBGE) campos.canal = "O canal municipal só existe para clientes de Salvador.";
    if (!Number.isInteger(entrada?.serieDps) || entrada.serieDps < 1 || entrada.serieDps > 49999) {
      campos.serieDps = "A série deve estar entre 1 e 49999 (faixa das notas emitidas por aplicativo próprio).";
    }
    if (entrada?.servicoPadrao && !descricaoDoServico(entrada.servicoPadrao)) campos.servicoPadrao = "Esse código não existe na lista nacional.";
    if (Object.keys(campos).length > 0) throw new Recusa(400, "Há campos para corrigir. Revise-os e tente de novo.", campos);

    const banco = this.carregar();
    let p = banco.perfis.find((x) => x.clienteId === clienteId);
    if (!p) {
      p = { clienteId, inscricaoMunicipal: null, municipioIbge: entrada.municipioIbge, opcaoSimples: entrada.opcaoSimples, regimeEspecial: "NENHUM", canal: entrada.canal, serieDps: entrada.serieDps, proximoNumeroDps: 1, servicoPadrao: null, certificado: null, portal: null, atividades: [], conexoes: { ...CONEXOES_VAZIAS } };
      banco.perfis.push(p);
    } else if (entrada.serieDps !== p.serieDps) {
      p.proximoNumeroDps = 1;
    }
    p.inscricaoMunicipal = entrada.inscricaoMunicipal?.trim() || null;
    p.municipioIbge = entrada.municipioIbge;
    p.opcaoSimples = entrada.opcaoSimples;
    p.regimeEspecial = entrada.regimeEspecial;
    p.canal = entrada.canal;
    p.serieDps = entrada.serieDps;
    p.servicoPadrao = entrada.servicoPadrao || null;
    p.conexoes = { ...CONEXOES_VAZIAS }; // qualquer mudança nos dados pede novo teste de cada canal
    this.gravar(banco);
    return { status: 200, json: perfilPublico(p, cliente, this.dep.hoje()) };
  }

  private perfilExistente(banco: Banco, clienteId: number): PerfilGuardado {
    const p = banco.perfis.find((x) => x.clienteId === clienteId);
    if (!p) throw new Recusa(409, "Salve primeiro os dados fiscais deste cliente.");
    return p;
  }

  private async enviarCertificado(clienteId: number, formulario: FormData | undefined): Promise<Resposta> {
    const cliente = await this.clienteOu404(clienteId);
    const arquivo = formulario?.get("arquivo");
    const senha = formulario?.get("senha");
    if (!(arquivo instanceof Blob) || arquivo.size === 0) throw new Recusa(400, "Escolha o arquivo do certificado.", { arquivo: "Escolha o arquivo do certificado." });
    const nome = (arquivo as File).name ?? "";
    if (!/\.(pfx|p12)$/i.test(nome)) {
      throw new Recusa(400, "O certificado precisa ser um arquivo .pfx ou .p12 (certificado A1).", { arquivo: "Use um arquivo .pfx ou .p12 (certificado A1)." });
    }
    if (arquivo.size > 1024 * 1024) throw new Recusa(400, "O arquivo é grande demais para um certificado.", { arquivo: "O arquivo é grande demais para um certificado." });
    if (typeof senha !== "string" || senha === "") throw new Recusa(400, "Informe a senha do certificado.", { senha: "Informe a senha do certificado." });
    // Simulação: no backend de verdade o arquivo é aberto com a senha e o CNPJ, o titular e a validade vêm dele.
    if (senha === "errada") throw new Recusa(422, "A senha do certificado não confere. Confira e tente de novo.", { senha: "A senha não confere." });

    const banco = this.carregar();
    const p = this.perfilExistente(banco, clienteId);
    const hoje = this.dep.hoje();
    const documento = /outro/i.test(nome) ? "99999999000191" : cliente.documento;
    p.certificado = {
      titular: `${cliente.nome.toUpperCase()}:${documento}`,
      cnpj: documento,
      validoAte: /vencido/i.test(nome) ? somarDias(hoje, -1) : somarDias(hoje, 365),
      enviadoEm: this.dep.agora().toISOString(),
    };
    p.conexoes.NACIONAL = null;
    this.gravar(banco);
    return { status: 200, json: perfilPublico(p, cliente, hoje) };
  }

  private async salvarPortal(clienteId: number, entrada: PortalInput): Promise<Resposta> {
    const cliente = await this.clienteOu404(clienteId);
    const campos: Record<string, string> = {};
    if (!entrada?.usuario?.trim()) campos.usuario = "Informe o usuário do portal.";
    if (!entrada?.senha) campos.senha = "Informe a senha do portal.";
    if (Object.keys(campos).length > 0) throw new Recusa(400, "Há campos para corrigir. Revise-os e tente de novo.", campos);
    // Simulação: o backend de verdade testaria o login no portal. A senha é guardada (criptografada) e nunca volta.
    if (entrada.senha === "errada") throw new Recusa(422, "O portal recusou o usuário e a senha. Confira e tente de novo.", { senha: "O portal recusou a senha." });

    const banco = this.carregar();
    const p = this.perfilExistente(banco, clienteId);
    if (p.municipioIbge !== SALVADOR_IBGE) throw new Recusa(409, "O acesso ao portal de Salvador só vale para clientes de Salvador.");
    p.portal = { usuario: entrada.usuario.trim(), atualizadoEm: this.dep.agora().toISOString() };
    p.atividades = ATIVIDADES_DEMO.map((a) => ({ ...a })); // a simulação "lê" as atividades do cliente no portal
    p.conexoes.MUNICIPAL_SALVADOR = null;
    this.gravar(banco);
    return { status: 200, json: perfilPublico(p, cliente, this.dep.hoje()) };
  }

  private async removerCredencial(clienteId: number, qual: "certificado" | "portal"): Promise<Resposta> {
    const cliente = await this.clienteOu404(clienteId);
    const banco = this.carregar();
    const p = this.perfilExistente(banco, clienteId);
    p[qual] = null;
    if (qual === "portal") p.atividades = [];
    p.conexoes[qual === "portal" ? "MUNICIPAL_SALVADOR" : "NACIONAL"] = null;
    this.gravar(banco);
    return { status: 200, json: perfilPublico(p, cliente, this.dep.hoje()) };
  }

  private async testarConexao(clienteId: number, canalPedido: string | null): Promise<Resposta> {
    const cliente = await this.clienteOu404(clienteId);
    const banco = this.carregar();
    const p = this.perfilExistente(banco, clienteId);
    const canal: CanalEmissao = canalPedido === "NACIONAL" || canalPedido === "MUNICIPAL_SALVADOR" ? canalPedido : p.canal;
    if (canal === "MUNICIPAL_SALVADOR" && p.municipioIbge !== SALVADOR_IBGE) {
      throw new Recusa(409, "O canal municipal só existe para clientes de Salvador.");
    }
    const { prontidao } = calcularProntidao(p, cliente, this.dep.hoje(), canal);
    const situacao = (id: string) => prontidao.find((i) => i.id === id);
    const etapas: ResultadoTesteConexao["etapas"] = [];
    const naoTestado = "Não testado: corrija a etapa anterior.";

    const credencial = situacao("CREDENCIAL");
    const credencialOk = credencial?.situacao !== "PENDENTE";
    etapas.push({ titulo: canal === "MUNICIPAL_SALVADOR" ? "Acesso ao portal de Salvador" : "Certificado digital", ok: credencialOk, detalhe: credencial?.detalhe ?? "" });

    const municipio = situacao("MUNICIPIO");
    const municipioOk = credencialOk && municipio?.situacao !== "PENDENTE";
    etapas.push({
      titulo: canal === "MUNICIPAL_SALVADOR" ? "Município atendido pelo canal municipal" : "Município no sistema nacional",
      ok: municipioOk,
      detalhe: credencialOk ? (municipio?.detalhe ?? "") : naoTestado,
    });

    if (canal === "MUNICIPAL_SALVADOR") {
      etapas.push({
        titulo: "Login no portal e leitura das atividades",
        ok: municipioOk,
        detalhe: municipioOk ? `O login foi aceito no portal da Prefeitura de Salvador e ${p.atividades.length} atividades do cliente foram lidas (simulado, com o captcha resolvido).` : naoTestado,
      });
    } else {
      const m = municipioPorIbge(p.municipioIbge);
      const liberado = municipioOk && m !== null && leituraDaSituacao(m).tom === "ok";
      etapas.push({
        titulo: "Parâmetros do município (convênio)",
        ok: liberado,
        detalhe: liberado ? "O convênio do município está ativo e libera os emissores públicos." : municipioOk ? "Não foi possível confirmar o convênio: veja o aviso do município acima." : naoTestado,
      });
      etapas.push({ titulo: "Credenciamento para emitir pela API", ok: liberado, detalhe: liberado ? "O sistema nacional aceitou o certificado do cliente (simulado)." : naoTestado });
    }

    const ok = etapas.every((e) => e.ok);
    if (ok) {
      p.conexoes[canal] = this.dep.agora().toISOString();
      this.gravar(banco);
    }
    const corpo: ResultadoTesteConexao = { ok, etapas };
    return { status: 200, json: corpo };
  }

  // ── Movimento no portal de Salvador (só leitura) ───────────────────────────────────────────

  private async listarMovimentos(clienteId: number): Promise<Resposta> {
    await this.clienteOu404(clienteId);
    const movimentos = this.carregar().movimentos.filter((m) => m.clienteId === clienteId);
    return { status: 200, json: movimentos.sort((a, b) => b.competencia.localeCompare(a.competencia)).slice(0, 12) };
  }

  /**
   * "Lê o portal": gera, para a competência, um movimento de mentira que depende só do cliente e do mês. As regras de recusa são as do
   * backend (competência válida e já iniciada, dados fiscais, cliente de Salvador, acesso ao portal guardado). Nada é emitido.
   */
  private async consultarMovimento(clienteId: number, entrada: { competencia: string }): Promise<Resposta> {
    const competencia = entrada?.competencia ?? "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) {
      throw new Recusa(400, "Há campos para corrigir. Revise-os e tente de novo.", { competencia: competencia ? "Use o formato AAAA-MM" : "Escolha o mês a consultar" });
    }
    const hoje = this.dep.hoje();
    if (competencia > hoje.slice(0, 7)) {
      throw new Recusa(400, "Há campos para corrigir. Revise-os e tente de novo.", { competencia: "Esse mês ainda não começou. Escolha o mês atual ou um anterior." });
    }
    await this.clienteOu404(clienteId);
    const banco = this.carregar();
    const perfil = banco.perfis.find((p) => p.clienteId === clienteId);
    if (!perfil) throw new Recusa(409, "Salve primeiro os dados fiscais deste cliente.");
    if (perfil.municipioIbge !== SALVADOR_IBGE) throw new Recusa(409, "A consulta ao portal de Salvador só vale para clientes de Salvador.");
    if (!perfil.portal) throw new Recusa(409, "Este cliente não tem o acesso ao portal de Salvador guardado. Cadastre o usuário e a senha dele primeiro.");

    const movimento = this.gerarMovimento(banco, clienteId, competencia);
    this.gravar(banco);
    return { status: 200, json: movimento };
  }

  /** O que a simulação "lê" no portal para um cliente e um mês: depende só dos dois. Grava no banco (sem salvar o arquivo). */
  private gerarMovimento(banco: Banco, clienteId: number, competencia: string): MovimentoPortal {
    const hoje = this.dep.hoje();
    const [ano, mes] = competencia.split("-").map(Number);
    const semente = mes + (clienteId % 5);
    const notas = (semente % 6) + 1;
    const valorEmitido = notas * 1500 + (semente % 3) * 250;
    const proximoMes = mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, "0")}`;
    const mesPassado = somarMeses(hoje.slice(0, 7), -1);
    const emitida = competencia < hoje.slice(0, 7); // o mês corrente ainda não fechou: a guia fica "a emitir" no portal
    const quitada = competencia < mesPassado; // meses mais antigos já foram pagos pelo cliente
    const guia: GuiaDoPortal = {
      incidencia: `${ABREVIACAO_DO_MES[mes - 1]} / ${ano}`,
      vencimento: `${proximoMes}-08`,
      valor: Math.round(valorEmitido * 5) / 100,
      numero: emitida ? `${ano}/${String(clienteId * 100 + mes).padStart(6, "0")}` : null,
      emitida,
      situacao: quitada ? "QUITADA" : "PENDENTE",
      quitadaEm: quitada ? `${proximoMes}-05` : null,
      guiaId: null, // na demonstração o módulo de Guias não recebe a guia
    };
    const existente = banco.movimentos.find((m) => m.clienteId === clienteId && m.competencia === competencia);
    const movimento: MovimentoPortal = {
      id: existente?.id ?? Math.max(0, ...banco.movimentos.map((m) => m.id)) + 1,
      clienteId,
      competencia,
      notasEmitidas: notas,
      valorEmitido,
      consultadoEm: this.dep.agora().toISOString(),
      guias: [guia],
    };
    banco.movimentos = [...banco.movimentos.filter((m) => m !== existente), movimento];
    return movimento;
  }

  // ── Financeiro e consulta em lote ──────────────────────────────────────────────────────────

  private async financeiro(mes: string): Promise<Resposta> {
    const base = await this.dep.financeiroDasGuias(mes);
    const banco = this.carregar();
    const doMes = banco.movimentos.filter((m) => m.competencia === base.mes);
    const consultaveis = banco.perfis.filter((p) => p.municipioIbge === SALVADOR_IBGE && p.portal !== null);

    const linhas = new Map<number, LinhaFinanceira>(base.clientes.map((c) => [c.clienteId, c]));
    for (const m of doMes) {
      const anterior = linhas.get(m.clienteId);
      const nome = anterior?.nome ?? (await this.dep.buscarCliente(m.clienteId))?.nome ?? `Cliente ${m.clienteId}`;
      linhas.set(m.clienteId, {
        clienteId: m.clienteId,
        nome,
        consultado: true,
        emitido: m.valorEmitido,
        notas: m.notasEmitidas,
        quitadoNoPortal: quitadoDe(m),
        emAberto: anterior?.emAberto ?? 0,
        vencido: anterior?.vencido ?? 0,
        guiasEmAberto: anterior?.guiasEmAberto ?? 0,
        proximoVencimento: anterior?.proximoVencimento ?? null,
      });
    }
    const ordenadas = [...linhas.values()].sort(
      (a, b) => b.vencido - a.vencido || b.emAberto - a.emAberto || b.emitido - a.emitido || a.nome.localeCompare(b.nome, "pt-BR"),
    );
    const corpo: Financeiro = {
      ...base,
      emitido: {
        valor: doMes.reduce((soma, m) => soma + m.valorEmitido, 0),
        notas: doMes.reduce((soma, m) => soma + m.notasEmitidas, 0),
        clientesConsultados: doMes.filter((m) => consultaveis.some((p) => p.clienteId === m.clienteId)).length,
        clientesComAcesso: consultaveis.length,
        ultimaConsulta: doMes.map((m) => m.consultadoEm).sort().at(-1) ?? null,
        guiasQuitadas: doMes.reduce((soma, m) => soma + quitadoDe(m), 0),
      },
      serie: base.serie.map((s) => ({ ...s, emitido: banco.movimentos.filter((m) => m.competencia === s.mes).reduce((soma, m) => soma + m.valorEmitido, 0) })),
      clientes: ordenadas,
    };
    return { status: 200, json: corpo };
  }

  private loteAtual(): Resposta {
    const lote = this.carregar().lote;
    return lote ? { status: 200, json: this.fotoDoLote(lote) } : { status: 204 };
  }

  private fotoDoLote(lote: NonNullable<Banco["lote"]>): LoteConsulta {
    return {
      id: lote.id,
      competencia: lote.competencia,
      estado: lote.estado,
      automatico: lote.automatico,
      iniciadoEm: lote.iniciadoEm,
      terminadoEm: lote.terminadoEm,
      total: lote.total,
      concluidos: lote.concluidos,
      comErro: lote.comErro,
      itens: lote.itens.map((i) => ({ ...i })),
    };
  }

  private async iniciarLote(entrada: { competencia: string; somenteFaltantes?: boolean }): Promise<Resposta> {
    const competencia = entrada?.competencia ?? "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) {
      throw new Recusa(400, "Há campos para corrigir. Revise-os e tente de novo.", { competencia: competencia ? "Use o formato AAAA-MM." : "Escolha o mês a consultar" });
    }
    if (competencia > this.dep.hoje().slice(0, 7)) {
      throw new Recusa(400, "Há campos para corrigir. Revise-os e tente de novo.", { competencia: "Esse mês ainda não começou. Escolha o mês atual ou um anterior." });
    }
    const banco = this.carregar();
    if (banco.lote?.estado === "EM_ANDAMENTO") throw new Recusa(409, `Já há uma consulta em lote em andamento (${banco.lote.competencia}). Espere ela terminar ou cancele.`);
    const somenteFaltantes = entrada.somenteFaltantes ?? true;
    const itens: LoteConsulta["itens"] = [];
    for (const p of banco.perfis.filter((p) => p.municipioIbge === SALVADOR_IBGE && p.portal !== null)) {
      const jaFoi = somenteFaltantes && banco.movimentos.some((m) => m.clienteId === p.clienteId && m.competencia === competencia);
      itens.push({
        clienteId: p.clienteId,
        nome: (await this.dep.buscarCliente(p.clienteId))?.nome ?? `Cliente ${p.clienteId}`,
        situacao: jaFoi ? "JA_CONSULTADO" : "AGUARDANDO",
        mensagem: jaFoi ? "Já consultado neste mês." : null,
      });
    }
    banco.lote = {
      id: `lote-${Date.now()}`,
      competencia,
      estado: "EM_ANDAMENTO",
      automatico: false,
      iniciadoEm: this.dep.agora().toISOString(),
      terminadoEm: null,
      total: itens.length,
      concluidos: 0,
      comErro: 0,
      itens,
      passoMs: Math.max(this.dep.atrasoMs(), 200) * 2,
    };
    this.avancarLote(banco);
    this.gravar(banco);
    return { status: 202, json: this.fotoDoLote(banco.lote) };
  }

  private cancelarLote(): Resposta {
    const banco = this.carregar();
    if (!banco.lote || banco.lote.estado !== "EM_ANDAMENTO") throw new Recusa(409, "Não há consulta em lote em andamento.");
    for (const item of banco.lote.itens) {
      if (item.situacao === "AGUARDANDO" || item.situacao === "CONSULTANDO") {
        item.situacao = "NAO_TENTADO";
        item.mensagem = "Cancelado antes de chegar neste cliente.";
      }
    }
    banco.lote.estado = "CANCELADO";
    banco.lote.terminadoEm = this.dep.agora().toISOString();
    this.gravar(banco);
    return { status: 200, json: this.fotoDoLote(banco.lote) };
  }

  /** Cada cliente do lote leva um passo; o que já passou do tempo é resolvido agora (não há timer, como nas notas). */
  private avancarLote(banco: Banco): boolean {
    const lote = banco.lote;
    if (!lote || lote.estado !== "EM_ANDAMENTO") return false;
    const decorrido = this.dep.agora().getTime() - new Date(lote.iniciadoEm).getTime();
    const feitosPorTempo = Math.floor(decorrido / lote.passoMs);
    let vez = 0;
    let mudou = false;
    for (const item of lote.itens) {
      if (item.situacao !== "AGUARDANDO" && item.situacao !== "CONSULTANDO") continue;
      vez++;
      if (vez <= feitosPorTempo) {
        const perfil = banco.perfis.find((p) => p.clienteId === item.clienteId);
        if (perfil?.portal?.usuario === "senha-trocada") {
          item.situacao = "ERRO";
          item.mensagem = "O portal recusou o usuário ou a senha. Confira e tente de novo.";
        } else {
          const m = this.gerarMovimento(banco, item.clienteId, lote.competencia);
          item.situacao = "OK";
          item.mensagem = `${m.notasEmitidas} ${m.notasEmitidas === 1 ? "nota emitida" : "notas emitidas"}, ${m.guias.length} ${m.guias.length === 1 ? "guia" : "guias"}.`;
        }
        mudou = true;
      } else if (vez === feitosPorTempo + 1 && item.situacao === "AGUARDANDO") {
        item.situacao = "CONSULTANDO";
        mudou = true;
      }
    }
    lote.concluidos = lote.itens.filter((i) => i.situacao === "OK" || i.situacao === "ERRO").length;
    lote.comErro = lote.itens.filter((i) => i.situacao === "ERRO").length;
    if (!lote.itens.some((i) => i.situacao === "AGUARDANDO" || i.situacao === "CONSULTANDO")) {
      lote.estado = "CONCLUIDO";
      lote.terminadoEm = this.dep.agora().toISOString();
      mudou = true;
    }
    return mudou;
  }

  // ── Tomadores ──────────────────────────────────────────────────────────────────────────────

  private validarTomadorEntrada(entrada: TomadorInput): { documento: string; nome: string; email: string | null } {
    const erros = validarTomador({ documento: entrada?.documento ?? "", nome: entrada?.nome ?? "", email: entrada?.email ?? "" });
    if (Object.keys(erros).length > 0) throw new Recusa(400, "Há campos para corrigir. Revise-os e tente de novo.", erros as Record<string, string>);
    return { documento: normalizarDocumento(entrada.documento), nome: entrada.nome.trim(), email: entrada.email?.trim() || null };
  }

  private async listarTomadores(clienteId: number, consulta: URLSearchParams): Promise<Resposta> {
    await this.clienteOu404(clienteId);
    const termo = semAcento(consulta.get("busca") ?? "").trim();
    const digitos = termo.replace(/\D/g, "");
    const todos = this.carregar()
      .tomadores.filter((t) => t.clienteId === clienteId)
      .filter((t) => !termo || semAcento(t.nome).includes(termo) || (digitos.length >= 3 && t.documento.includes(digitos)))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const tamanho = Math.min(Math.max(Number(consulta.get("size")) || TAMANHO_DA_PAGINA, 1), 100);
    const pagina = Math.max(Number(consulta.get("page")) || 0, 0);
    const corpo: Pagina<Tomador> = { content: todos.slice(pagina * tamanho, (pagina + 1) * tamanho), page: pagina, size: tamanho, totalElements: todos.length, totalPages: Math.ceil(todos.length / tamanho) };
    return { status: 200, json: corpo };
  }

  private async criarTomador(clienteId: number, entrada: TomadorInput): Promise<Resposta> {
    await this.clienteOu404(clienteId);
    const dados = this.validarTomadorEntrada(entrada);
    const banco = this.carregar();
    if (banco.tomadores.some((t) => t.clienteId === clienteId && t.documento === dados.documento)) {
      throw new Recusa(409, "Este CPF/CNPJ já está na lista de tomadores deste cliente.", { documento: "Já está na lista deste cliente." });
    }
    const tomador: Tomador = { id: banco.proximoIdTomador++, clienteId, ...dados };
    banco.tomadores.push(tomador);
    this.gravar(banco);
    return { status: 201, json: tomador };
  }

  private atualizarTomador(id: number, entrada: TomadorInput): Resposta {
    const dados = this.validarTomadorEntrada(entrada);
    const banco = this.carregar();
    const tomador = banco.tomadores.find((t) => t.id === id);
    if (!tomador) throw new Recusa(404, "Tomador não encontrado.");
    if (banco.tomadores.some((t) => t.id !== id && t.clienteId === tomador.clienteId && t.documento === dados.documento)) {
      throw new Recusa(409, "Este CPF/CNPJ já está na lista de tomadores deste cliente.", { documento: "Já está na lista deste cliente." });
    }
    Object.assign(tomador, dados); // as notas já emitidas guardam a cópia de quando saíram
    this.gravar(banco);
    return { status: 200, json: tomador };
  }

  private excluirTomador(id: number): Resposta {
    const banco = this.carregar();
    if (!banco.tomadores.some((t) => t.id === id)) throw new Recusa(404, "Tomador não encontrado.");
    banco.tomadores = banco.tomadores.filter((t) => t.id !== id);
    for (const n of banco.notas) if (n.tomadorId === id) n.tomadorId = null;
    this.gravar(banco);
    return { status: 204 };
  }
}
