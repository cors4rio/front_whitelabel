// Contratos da API (backend Spring Boot do projeto, em repositório separado). Manter em sincronia com os records Java.

export type Papel = "ADMIN" | "COLABORADOR";
export type StatusCliente = "ATIVO" | "INATIVO";
export type TipoPessoa = "PF" | "PJ";

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  papel: Papel;
}

export interface Sessao {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  usuario: Usuario;
}

export interface Cliente {
  id: number;
  tipoPessoa: TipoPessoa;
  nomeRazaoSocial: string;
  cpfCnpj: string;
  email: string | null;
  telefone: string | null;
  planoId: number | null;
  planoNome: string | null;
  status: StatusCliente;
  clienteDesde: string | null;
  createdAt: string;
}

export interface ClienteInput {
  nomeRazaoSocial: string;
  cpfCnpj: string;
  email: string | null;
  telefone: string | null;
  planoId: number | null;
  status: StatusCliente;
  clienteDesde: string | null;
}

export interface Plano {
  id: number;
  nome: string;
  valor: number;
  descricao: string | null;
  ativo: boolean;
}

export interface Pagina<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ErroImportacao {
  linha: number;
  documento: string | null;
  mensagem: string;
}

export interface ResultadoImportacao {
  simulacao: boolean;
  totalLinhas: number;
  importados: number;
  comErro: number;
  erros: ErroImportacao[];
}

export interface ResumoPainel {
  /** Em reais: tudo que está pendente, e a parte que já venceu. */
  valorGuiasEmAberto: number;
  valorGuiasVencidas: number;
  /** AAAA-MM do mês passado e o que os clientes emitiram nele segundo o portal de Salvador (null = ninguém foi consultado). */
  mesAnterior: string;
  emitidoMesAnterior: number | null;
  clientesAtivos: number;
  clientesInativos: number;
  clientesAtivosSemPlano: number;
  receitaMensalPrevista: number;
  guiasVencidas: number;
  guiasVencendo: number;
  /** Guias pendentes por dia de vencimento, de hoje (índice 0) até hoje + 7: 8 posições. */
  vencimentosProximos: number[];
}

/** O financeiro do escritório num mês (GET /financeiro?mes=AAAA-MM). Tudo em reais. */
export interface Financeiro {
  mes: string;
  guias: {
    emAberto: number;
    quantidadeEmAberto: number;
    vencidas: number;
    quantidadeVencidas: number;
    vencendo: number;
    quantidadeVencendo: number;
    pagasNoMes: number;
    quantidadePagasNoMes: number;
    /** ESTIMATIVA do que as vencidas custariam se pagas hoje (multa e juros incluídos nas federais). */
    vencidasPagasHoje: number;
    /** Quantas vencidas entraram só pelo valor original (FGTS, ISS, outras) ou por falta de Selic. */
    vencidasSemEstimativa: number;
  };
  emitido: {
    valor: number;
    notas: number;
    clientesConsultados: number;
    /** Clientes ativos de Salvador com o acesso ao portal guardado: os que podem ser consultados. */
    clientesComAcesso: number;
    ultimaConsulta: string | null;
    /** Quanto, em guias deste mês, o portal mostrou como quitado. */
    guiasQuitadas: number;
  };
  /** Os últimos 6 meses até o escolhido, o mais antigo primeiro. */
  serie: { mes: string; emitido: number; pago: number }[];
  clientes: LinhaFinanceira[];
}

export interface LinhaFinanceira {
  clienteId: number;
  nome: string;
  /** false = o portal não foi lido para este cliente neste mês (emitido e notas ficam zerados). */
  consultado: boolean;
  emitido: number;
  notas: number;
  /** Guias do mês que o portal mostrou como quitadas. */
  quitadoNoPortal: number;
  emAberto: number;
  vencido: number;
  guiasEmAberto: number;
  proximoVencimento: string | null;
}

export type EstadoDoLote = "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO" | "INTERROMPIDO";
export type SituacaoNoLote = "JA_CONSULTADO" | "AGUARDANDO" | "CONSULTANDO" | "OK" | "ERRO" | "NAO_TENTADO";

/** A consulta ao portal de Salvador para vários clientes de uma vez. Só leitura. */
export interface LoteConsulta {
  id: string;
  competencia: string;
  estado: EstadoDoLote;
  automatico: boolean;
  iniciadoEm: string;
  terminadoEm: string | null;
  total: number;
  concluidos: number;
  comErro: number;
  itens: { clienteId: number; nome: string; situacao: SituacaoNoLote; mensagem: string | null }[];
}

export type StatusGuia = "PENDENTE" | "PAGA" | "CANCELADA";

/** O que a listagem de guias pode pedir. TODAS = sem filtro (o parâmetro some da requisição). */
export type FiltroSituacao = "EM_ABERTO" | "VENCIDA" | "VENCENDO" | "PAGA" | "CANCELADA" | "TODAS";

export interface ArquivoInfo {
  id: number;
  nome: string;
  tipo: string;
  tamanho: number;
}

/**
 * vencida/vencendo/diasParaVencimento vêm calculados pelo servidor com o "hoje" do escritório (Brasília):
 * a tela não deve recalcular com o relógio do aparelho.
 */
/** Que guia é. Define se o sistema sabe estimar multa e juros (só as federais) e, depois, por onde a guia é recalculada. */
export type TipoGuia = "DAS" | "DAS_MEI" | "DARF" | "GPS" | "FGTS" | "DAE_ESOCIAL" | "DAM_ISS" | "PARCELAMENTO" | "OUTRA";

export interface Guia {
  id: number;
  clienteId: number;
  clienteNome: string;
  clienteCpfCnpj: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: StatusGuia;
  vencida: boolean;
  vencendo: boolean;
  diasParaVencimento: number;
  dataPagamento: string | null;
  pagoPorNome: string | null;
  pagoEm: string | null;
  arquivo: ArquivoInfo | null;
  comprovante: ArquivoInfo | null;
  createdAt: string;
  tipo: TipoGuia;
  /** O mês a que a guia se refere (AAAA-MM); null = não informado. */
  competencia: string | null;
}

export interface GuiaInput {
  clienteId: number;
  descricao: string;
  valor: number;
  vencimento: string;
  tipo: TipoGuia;
  competencia: string | null;
}

/**
 * Quanto custaria pagar uma guia vencida numa data (GET /guias/{id}/estimativa). SEMPRE uma estimativa: o valor que vale é o do
 * sistema oficial. Sem `estimavel`, `motivo` diz por quê e onde ver o valor certo; com `mesesSemSelic`, falta a taxa de algum mês e não há total.
 */
export interface EstimativaDoAtraso {
  guiaId: number;
  tipo: TipoGuia;
  estimavel: boolean;
  motivo: string | null;
  vencimento: string;
  dataDePagamento: string;
  diasDeAtraso: number;
  principal: number;
  multaPercentual: number | null;
  multa: number | null;
  jurosPercentual: number | null;
  juros: number | null;
  total: number | null;
  mesesSemSelic: string[];
  aviso: string;
}

/** A Selic acumulada de um mês fechado, em %, que entra nos juros da estimativa. */
export interface SelicDoMes {
  competencia: string;
  taxa: number;
  fonte: "BCB" | "MANUAL";
  atualizadoEm: string;
}

// ── Notas fiscais (NFS-e Nacional) ────────────────────────────────────────────────────────────
// Contrato que o backend vai implementar (ver README, seção "Backend e contrato da API"). Enquanto ele não
// existe, a tela conversa com uma simulação no navegador que respeita este mesmo contrato (lib/notas/demo).
// O PRESTADOR é o cliente do escritório (o escritório emite em nome dele); o TOMADOR é quem compra do cliente.

export type StatusNota = "RASCUNHO" | "ENVIADA" | "AUTORIZADA" | "REJEITADA" | "CANCELADA";

/** O que a listagem de notas pode pedir. TODAS = sem filtro (o parâmetro some da requisição). */
export type FiltroStatusNota = StatusNota | "TODAS";

/** HOMOLOGACAO = "produção restrita" do sistema nacional: a nota sai com valor de teste, sem validade fiscal. */
export type AmbienteNfse = "HOMOLOGACAO" | "PRODUCAO";

/**
 * Por onde a nota de um cliente é emitida. NACIONAL (o padrão do sistema): API do sistema nacional, com o certificado
 * A1 do cliente. MUNICIPAL_SALVADOR: portal da Prefeitura de Salvador, sem certificado, com o usuário e a senha do
 * cliente; só existe para cliente de Salvador, é mais frágil (captcha, mudanças no portal) e a tela sempre avisa.
 * Um cliente de Salvador pode ter os dois canais prontos e escolhe por qual emitir a cada nota.
 */
export type CanalEmissao = "NACIONAL" | "MUNICIPAL_SALVADOR";

/** Campo do formulário a que um erro se refere; o servidor traduz o código do erro nacional (E0016...) para ele. */
export type CampoNota =
  | "cliente"
  | "tomador"
  | "competencia"
  | "servico"
  | "descricao"
  | "valor"
  | "retencao"
  | "prestador"
  | "certificado";

/** Motivo de uma rejeição como o sistema nacional devolveu (código "E0312" e texto oficial). */
export interface ErroFiscal {
  codigo: string;
  mensagem: string;
  campo: CampoNota | null;
}

/** CONFERIDA: a nota foi montada e conferida até a confirmação, sem ser enviada (o envio está desligado nesta instalação). */
export type TipoEventoNota = "RASCUNHO_CRIADO" | "EDITADA" | "CONFERIDA" | "ENVIADA" | "AUTORIZADA" | "REJEITADA" | "CANCELADA";

/** Uma linha da linha do tempo da nota. {@code por} é null quando quem agiu foi o sistema (autorização, rejeição). */
export interface EventoNota {
  tipo: TipoEventoNota;
  em: string;
  por: string | null;
  detalhe: string | null;
}

/** Códigos do evento de cancelamento (e101101): 1 erro na emissão, 2 serviço não prestado, 9 outros. */
export type MotivoCancelamento = 1 | 2 | 9;

export interface CancelamentoNota {
  motivo: MotivoCancelamento;
  justificativa: string;
  canceladaEm: string;
  canceladaPorNome: string | null;
}

/** Valores (R$) retidos na fonte pelo tomador; null = não retido. Vão na DPS (vRetIRRF, vRetCSLL, PIS/COFINS, vRetCP). */
export interface RetencoesFederais {
  irrf: number | null;
  csll: number | null;
  pis: number | null;
  cofins: number | null;
  previdencia: number | null;
}

/** Quem compra do cliente: a lista de tomadores de cada cliente. */
export interface Tomador {
  id: number;
  clienteId: number;
  /** CPF ou CNPJ normalizado (sem pontuação, maiúsculo). */
  documento: string;
  nome: string;
  email: string | null;
}

export interface TomadorInput {
  documento: string;
  nome: string;
  email: string | null;
}

/**
 * Prestador e tomador são cópias (nome, documento) do que valeu na emissão: o documento fiscal não muda se o cadastro
 * mudar depois. {@code clienteId} (o prestador) é null se o cliente deixou de existir.
 */
export interface NotaFiscalResumo {
  id: number;
  clienteId: number | null;
  prestadorNome: string;
  prestadorDocumento: string;
  tomadorNome: string;
  tomadorDocumento: string;
  descricaoServico: string;
  valor: number;
  /** AAAA-MM-DD: data em que o serviço foi prestado (dCompet). */
  competencia: string;
  /** Número da NFS-e, dado pelo sistema nacional só depois de autorizada. */
  numero: string | null;
  status: StatusNota;
  ambiente: AmbienteNfse;
  canal: CanalEmissao;
  emitidaEm: string | null;
  createdAt: string;
}

export interface NotaFiscal extends NotaFiscalResumo {
  /** null se o tomador saiu da lista do cliente depois da emissão. */
  tomadorId: number | null;
  tomadorEmail: string | null;
  /** Código de tributação nacional, 6 dígitos (cTribNac), ex.: "171901" = contabilidade. */
  codigoServico: string;
  issRetido: boolean;
  retencoes: RetencoesFederais;
  informacoesComplementares: string | null;
  serie: number | null;
  /** Número da DPS (nDPS), o da tentativa de emissão; não é o número da nota. */
  numeroDps: number | null;
  chaveAcesso: string | null;
  /** Só existe quando o prestador não é do Simples Nacional: no Simples o ISS segue no DAS. */
  aliquotaIss: number | null;
  valorIss: number | null;
  /** Motivos da última tentativa recusada; vazio nas demais situações. */
  rejeicoes: ErroFiscal[];
  cancelamento: CancelamentoNota | null;
  historico: EventoNota[];
  temXml: boolean;
  temPdf: boolean;
}

export interface NotaFiscalInput {
  /** O prestador: o cliente que emite. */
  clienteId: number;
  /** Por onde esta nota sai. */
  canal: CanalEmissao;
  tomadorId: number;
  competencia: string;
  codigoServico: string;
  descricaoServico: string;
  valor: number;
  issRetido: boolean;
  retencoes: RetencoesFederais;
  informacoesComplementares: string | null;
}

export interface CancelamentoInput {
  motivo: MotivoCancelamento;
  justificativa: string;
}

/** opSimpNac da DPS: 1 não optante, 2 MEI, 3 ME/EPP. */
export type OpcaoSimples = "NAO_OPTANTE" | "ME_EPP" | "MEI";

/** Regimes especiais de tributação municipal da DPS (regEspTrib 0, 1, 2, 3, 4, 5, 6 e 9). */
export type RegimeEspecial =
  | "NENHUM"
  | "ATO_COOPERADO"
  | "ESTIMATIVA"
  | "MICROEMPRESA_MUNICIPAL"
  | "NOTARIO_REGISTRADOR"
  | "PROFISSIONAL_AUTONOMO"
  | "SOCIEDADE_PROFISSIONAIS"
  | "OUTROS";

export interface CertificadoInfo {
  titular: string;
  cnpj: string;
  /** AAAA-MM-DD */
  validoAte: string;
  enviadoEm: string;
}

/** O login do cliente no portal (a senha nunca volta da API). */
export interface PortalInfo {
  usuario: string;
  atualizadoEm: string;
}

/**
 * O que se leu no portal de Salvador, com o login do cliente, numa competência (AAAA-MM): as NFS-e que ele emitiu e as
 * guias (DAM) do mês. Só leitura: nada disso emite nota nem guia.
 */
export interface MovimentoPortal {
  id: number;
  clienteId: number;
  competencia: string;
  notasEmitidas: number;
  valorEmitido: number;
  consultadoEm: string;
  guias: GuiaDoPortal[];
}

export interface GuiaDoPortal {
  incidencia: string;
  vencimento: string | null;
  valor: number | null;
  /** null = o portal ainda não emitiu esta guia ("a emitir"); o sistema não a emite. */
  numero: string | null;
  emitida: boolean;
  /** A aba do portal em que a guia apareceu: pendente (a cobrar) ou quitada (já paga pelo cliente). */
  situacao: "PENDENTE" | "QUITADA";
  /** O dia do pagamento, só para a quitada. */
  quitadaEm: string | null;
  /** A guia criada no módulo de Guias a partir do PDF do portal (só existe para guia emitida e lida por inteiro). */
  guiaId: number | null;
}

export type SituacaoProntidao = "OK" | "ATENCAO" | "PENDENTE";

/** Um item da lista "este cliente está pronto para emitir?"; PENDENTE bloqueia a emissão, ATENCAO só avisa. */
export interface ItemProntidao {
  id: "DADOS" | "CREDENCIAL" | "MUNICIPIO" | "CONEXAO";
  titulo: string;
  situacao: SituacaoProntidao;
  detalhe: string;
}

/** Um serviço que o cliente tem cadastrado no portal de Salvador (CNAE, item da lista, tributação municipal). */
export interface AtividadeMunicipal {
  /** Código de tributação nacional equivalente (6 dígitos), o mesmo da lista nacional. */
  codigoServico: string;
  /** Código de tributação municipal (CTISS) no portal. */
  ctiss: string;
  /** Alíquota do ISS em %, vinda do CTISS. */
  aliquota: number;
}

/** A situação de UM canal para um cliente: se existe para ele, se está pronto e o que falta. */
export interface CanalDoPerfil {
  canal: CanalEmissao;
  /** false quando o canal não se aplica ao cliente (o municipal só existe para quem é de Salvador). */
  disponivel: boolean;
  /** Por que não está disponível, em texto; null quando está. */
  indisponivelPorque: string | null;
  pronta: boolean;
  prontidao: ItemProntidao[];
  /** Quando a conexão deste canal foi testada com sucesso pela última vez. */
  conexaoTestadaEm: string | null;
}

/** Dados fiscais de um cliente como prestador. O arquivo/senha do certificado e a senha do portal nunca voltam da API. */
export interface PerfilFiscal {
  clienteId: number;
  clienteNome: string;
  clienteDocumento: string;
  /** false até a primeira vez que alguém salvou os dados. */
  configurado: boolean;
  inscricaoMunicipal: string | null;
  municipioIbge: string | null;
  municipioNome: string | null;
  uf: string | null;
  opcaoSimples: OpcaoSimples | null;
  regimeEspecial: RegimeEspecial;
  /** O canal padrão do cliente; cada nota escolhe o seu. */
  canal: CanalEmissao;
  /** Faixa 1–49999: a das DPS emitidas por aplicativo próprio. */
  serieDps: number;
  proximoNumeroDps: number;
  servicoPadrao: string | null;
  certificado: CertificadoInfo | null;
  portal: PortalInfo | null;
  /** Atividades do cliente no portal de Salvador (vazio até o acesso do portal ser salvo). */
  atividadesMunicipais: AtividadeMunicipal[];
  /** Os canais do cliente (o nacional sempre; o municipal só se ele for de Salvador). */
  canais: CanalDoPerfil[];
  /** Pré-requisitos do canal padrão (o resumo; o detalhe de cada canal está em `canais`). */
  prontidao: ItemProntidao[];
  pronta: boolean;
}

export interface PerfilFiscalInput {
  inscricaoMunicipal: string | null;
  municipioIbge: string;
  opcaoSimples: OpcaoSimples;
  regimeEspecial: RegimeEspecial;
  canal: CanalEmissao;
  serieDps: number;
  servicoPadrao: string | null;
}

export interface PerfilFiscalResumo {
  clienteId: number;
  clienteNome: string;
  clienteDocumento: string;
  configurado: boolean;
  municipioNome: string | null;
  uf: string | null;
  canal: CanalEmissao;
  pronta: boolean;
}

export type FiltroPerfil = "TODOS" | "PRONTOS" | "PENDENTES" | "NAO_CONFIGURADOS";

export interface PortalInput {
  usuario: string;
  senha: string;
}

/** O que vale para o escritório todo: o ambiente das emissões. */
export interface ConfiguracaoFiscal {
  ambiente: AmbienteNfse;
}

export interface EtapaTesteConexao {
  titulo: string;
  ok: boolean;
  detalhe: string;
}

export interface ResultadoTesteConexao {
  ok: boolean;
  etapas: EtapaTesteConexao[];
}

// ── Fator R ───────────────────────────────────────────────────────────────────────────────────

/**
 * O Fator R de um cliente num mês de apuração: folha ÷ receita dos 12 meses anteriores. 28% ou mais = Anexo III; abaixo, Anexo V.
 * Só entram os meses em que a folha e a receita são conhecidas; `completo` diz se foram os 12.
 */
export interface ResultadoFatorR {
  folha12: number;
  receita12: number;
  mesesConsiderados: number;
  completo: boolean;
  /** A razão (0,285 = 28,5%); null = sem base para calcular. */
  fator: number | null;
  anexo: "III" | "V" | null;
  /** Quanto de folha faltaria, nesses meses, para chegar a 28%. */
  faltaDeFolha: number;
}

export interface FatorRLista {
  mes: string;
  clientes: { clienteId: number; nome: string; resultado: ResultadoFatorR }[];
}

export interface MesDoFatorR {
  competencia: string;
  folha: number | null;
  /** O que se digitou; null = não digitado. */
  receitaInformada: number | null;
  /** O que o cliente emitiu segundo a consulta ao portal; null = mês não consultado. */
  receitaDoPortal: number | null;
  /** A que vale na conta: a informada, senão a do portal. */
  receita: number | null;
  /** O Fator R tendo este mês como mês de apuração (usa os 12 meses anteriores a ele). */
  resultado: ResultadoFatorR;
}

export interface FatorRDoCliente {
  clienteId: number;
  nome: string;
  mes: string;
  atual: ResultadoFatorR;
  meses: MesDoFatorR[];
}
