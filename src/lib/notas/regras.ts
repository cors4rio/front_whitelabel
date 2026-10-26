import { dataBR, dataDoInstanteBR, dataHoraBR } from "../format.ts";
import { parseDinheiro } from "../dinheiro.ts";
import { documentoValido } from "../documento.ts";
import type {
  AmbienteNfse,
  CampoNota,
  EventoNota,
  FiltroStatusNota,
  CanalEmissao,
  MotivoCancelamento,
  NotaFiscal,
  RetencoesFederais,
  StatusNota,
} from "../types.ts";

export type Tom = "ok" | "atencao" | "problema" | "neutro";

export const ROTULO_STATUS: Record<StatusNota, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  AUTORIZADA: "Autorizada",
  REJEITADA: "Rejeitada",
  CANCELADA: "Cancelada",
};

export const TOM_STATUS: Record<StatusNota, Tom> = {
  RASCUNHO: "neutro",
  ENVIADA: "atencao",
  AUTORIZADA: "ok",
  REJEITADA: "problema",
  CANCELADA: "neutro",
};

/** Opções do filtro de situação da lista. "Enviada" aparece como "Em processamento": é o que a pessoa vê acontecer. */
export const OPCOES_STATUS: { valor: FiltroStatusNota; rotulo: string }[] = [
  { valor: "TODAS", rotulo: "Todas as situações" },
  { valor: "RASCUNHO", rotulo: "Rascunhos" },
  { valor: "ENVIADA", rotulo: "Em processamento" },
  { valor: "AUTORIZADA", rotulo: "Autorizadas" },
  { valor: "REJEITADA", rotulo: "Rejeitadas" },
  { valor: "CANCELADA", rotulo: "Canceladas" },
];

export const ROTULO_AMBIENTE: Record<AmbienteNfse, string> = {
  HOMOLOGACAO: "Homologação",
  PRODUCAO: "Produção",
};

/** Limites do leiaute da DPS (xDescServ, xInfComp) e do evento de cancelamento (xMotivo). */
export const DESCRICAO_MAX = 1000;
/** O formulário do portal de Salvador aceita mais caracteres na discriminação que a DPS nacional. */
export const DESCRICAO_MAX_MUNICIPAL = 2000;
export const descricaoMax = (canal: CanalEmissao) => (canal === "MUNICIPAL_SALVADOR" ? DESCRICAO_MAX_MUNICIPAL : DESCRICAO_MAX);

/** Código IBGE de Salvador: o canal municipal só existe para clientes daqui. */
export const SALVADOR_IBGE = "2927408";
export const INFORMACOES_MAX = 2000;
export const JUSTIFICATIVA_MIN = 15;
export const JUSTIFICATIVA_MAX = 255;
export const VALOR_MAXIMO = 99_999_999.99;

export const MOTIVOS_CANCELAMENTO: { valor: MotivoCancelamento; rotulo: string }[] = [
  { valor: 1, rotulo: "Erro na emissão" },
  { valor: 2, rotulo: "Serviço não prestado" },
  { valor: 9, rotulo: "Outros" },
];

export const rotuloDoMotivo = (motivo: MotivoCancelamento) =>
  MOTIVOS_CANCELAMENTO.find((m) => m.valor === motivo)?.rotulo ?? "Outros";

// ── Situações ────────────────────────────────────────────────────────────────────────────────

/** Rascunho e rejeitada são as únicas que se corrigem; as demais já saíram (ou estão saindo) para o sistema nacional. */
export const notaEditavel = (status: StatusNota) => status === "RASCUNHO" || status === "REJEITADA";

export const notaEmitivel = notaEditavel;

export const notaCancelavel = (status: StatusNota) => status === "AUTORIZADA";

/** Enquanto a nota espera a resposta do sistema nacional, a tela se atualiza sozinha. */
export const notaEmProcessamento = (status: StatusNota) => status === "ENVIADA";

/**
 * Nota emitida em homologação enquanto o sistema já está em produção: precisa de um aviso na lista, porque ali
 * ela se parece com as demais. Com o sistema todo em homologação, o aviso é um só, no topo da tela.
 */
export const notaDeTeste = (nota: Pick<NotaFiscal, "ambiente">, ambienteAtual: AmbienteNfse) =>
  nota.ambiente === "HOMOLOGACAO" && ambienteAtual === "PRODUCAO";

// ── Textos ───────────────────────────────────────────────────────────────────────────────────

/** "2026-10-21" → "Honorários contábeis referentes a 10/2026". */
export function descricaoSugerida(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  return mes && ano ? `Honorários contábeis referentes a ${mes}/${ano}` : "Honorários contábeis";
}

/** A descrição só deve ser trocada pela sugestão se está vazia ou ainda é uma sugestão antiga (de outra competência). */
export function descricaoPodeSerSugerida(descricao: string, sugestao: string): boolean {
  const atual = descricao.trim();
  return atual !== sugestao && (atual === "" || /^Honorários contábeis referentes a \d{2}\/\d{4}$/.test(atual));
}

/** "12345678901234567890123456789012345678901234567890" → blocos de 4, para conferir a olho. */
export function formatarChaveDeAcesso(chave: string | null | undefined): string {
  return (chave ?? "").replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function rotuloDoEvento(evento: Pick<EventoNota, "tipo">): string {
  switch (evento.tipo) {
    case "RASCUNHO_CRIADO":
      return "Rascunho criado";
    case "EDITADA":
      return "Dados alterados";
    case "CONFERIDA":
      return "Conferida até a confirmação (nada foi enviado)";
    case "ENVIADA":
      return "Enviada para autorização";
    case "AUTORIZADA":
      return "Autorizada pelo sistema nacional";
    case "REJEITADA":
      return "Rejeitada pelo sistema nacional";
    case "CANCELADA":
      return "Cancelada";
  }
}

export const TOM_DO_EVENTO: Record<EventoNota["tipo"], Tom> = {
  RASCUNHO_CRIADO: "neutro",
  EDITADA: "neutro",
  CONFERIDA: "atencao",
  ENVIADA: "atencao",
  AUTORIZADA: "ok",
  REJEITADA: "problema",
  CANCELADA: "neutro",
};

/** Nome de arquivo sem os caracteres que o Windows e o macOS recusam. */
export function nomeSeguroDeArquivo(texto: string, extensao: string): string {
  const limpo = texto
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${limpo || "NFS-e"}.${extensao}`;
}

/** "NFS-e 123 - Marina Ferraz.pdf" (o nome do prestador, que é o cliente) (ou "NFS-e rascunho 7 - ..." enquanto não há número). */
export function nomeDoArquivoDaNota(nota: Pick<NotaFiscal, "id" | "numero" | "prestadorNome">, extensao: "pdf" | "xml"): string {
  const numero = nota.numero ? nota.numero : `id ${nota.id}`;
  return nomeSeguroDeArquivo(`NFS-e ${numero} - ${nota.prestadorNome}`, extensao);
}

// ── Orientação para os erros do sistema nacional ───────────────────────────────────────────────

/**
 * O texto oficial da rejeição diz o que está errado, mas raramente o que fazer. Estes são os códigos que uma
 * nota de honorários contábeis costuma encontrar (lista oficial: Anexo I, aba "RN DPS_NFS-e"); os demais
 * aparecem só com a mensagem original.
 */
const ORIENTACOES: Record<string, string> = {
  E0014: "O número desta DPS já foi usado em outra nota. Reemitir usa o próximo número.",
  E0015: "A competência não pode ser depois da data da emissão. Use hoje ou uma data anterior.",
  E0016: "A competência é anterior ao início do convênio do município com o sistema nacional. Use uma data a partir dele.",
  E1270: "A competência é anterior ao início do convênio do município com o sistema nacional. Use uma data a partir dele.",
  E0018: "A competência é anterior à abertura do CNPJ do escritório.",
  E0160: "O regime do Simples Nacional informado não confere com o cadastro da Receita nessa competência. Confira a configuração fiscal.",
  E0233: "Corrija o cadastro do tomador e volte a emitir.",
  E0247: "O e-mail do tomador está inválido. Corrija-o na lista de tomadores e volte a emitir.",
  E0310: "Esse código de serviço não existe na lista nacional. Escolha outro.",
  E0312: "A prefeitura não administra esse serviço no sistema nacional. Escolha um serviço que ela aceite ou fale com a prefeitura.",
  E0580: "Neste caso o município não permite reter o ISS. Desmarque “ISS retido pelo tomador”.",
  E0583: "Este prestador não pode ter o ISS retido. Desmarque “ISS retido pelo tomador”.",
  E0588: "Com este regime especial de tributação não pode haver retenção do ISS. Desmarque “ISS retido pelo tomador”.",
  E0715: "O certificado digital não é válido para assinar. Envie outro nos dados fiscais do cliente.",
  E0716: "O certificado digital fora do padrão exigido (ICP-Brasil, com CNPJ). Envie outro nos dados fiscais do cliente.",
  E0718: "A nota precisa ser assinada com o certificado do próprio cliente (o prestador). Confira o certificado nos dados fiscais dele.",
  E1203: "O certificado digital venceu. Envie o novo nos dados fiscais do cliente.",
  E1209: "O certificado digital não traz o CNPJ do titular. Envie um certificado de pessoa jurídica (e-CNPJ).",
  E0822: "Passou do prazo para cancelar direto no sistema. É preciso pedir análise fiscal à prefeitura.",
  E0823: "O valor da nota é maior que o limite que a prefeitura permite cancelar direto. É preciso pedir análise fiscal.",
  E0824: "Uma nota sem tomador identificado não pode ser cancelada direto. É preciso pedir análise fiscal.",
};

export function orientacaoParaErro(codigo: string): string | null {
  return ORIENTACOES[codigo.trim().toUpperCase()] ?? null;
}

/** O backend manda erros fiscais como "E0822: texto"; devolve o código ou null se a mensagem não começar por um. */
export function codigoNaMensagem(mensagem: string): string | null {
  return /^(E\d{4}):/.exec(mensagem.trim())?.[1] ?? null;
}

// ── Validação do formulário (retorno imediato; o servidor continua sendo a autoridade) ───────────

export const CAMPOS_DE_RETENCAO = ["irrf", "csll", "pis", "cofins", "previdencia"] as const;
export type CampoRetencao = (typeof CAMPOS_DE_RETENCAO)[number];

export const ROTULO_RETENCAO: Record<CampoRetencao, string> = {
  irrf: "IRRF",
  csll: "CSLL",
  pis: "PIS",
  cofins: "COFINS",
  previdencia: "Previdência (CP)",
};

export interface EstadoNota {
  /** Por onde a nota sai. */
  canal: CanalEmissao;
  /** O prestador: o cliente que emite. */
  cliente: { id: number } | null;
  tomador: { id: number } | null;
  competencia: string;
  codigoServico: string;
  descricao: string;
  valor: string;
  informacoes: string;
  /** Valores digitados das retenções federais (vazio = não retido). */
  retencoes: Record<CampoRetencao, string>;
}

export const RETENCOES_VAZIAS: Record<CampoRetencao, string> = { irrf: "", csll: "", pis: "", cofins: "", previdencia: "" };

export type CampoNotaForm = "cliente" | "tomador" | "competencia" | "servico" | "descricao" | "valor" | "retencoes" | "informacoes";
export type ErrosNota = Partial<Record<CampoNotaForm, string>>;

/** Lê as retenções digitadas; null em cada uma que está vazia ou não é um valor válido (a validação reclama do inválido). */
export function lerRetencoes(texto: Record<CampoRetencao, string>): RetencoesFederais {
  const ler = (campo: CampoRetencao) => (texto[campo].trim() === "" ? null : parseDinheiro(texto[campo]));
  return { irrf: ler("irrf"), csll: ler("csll"), pis: ler("pis"), cofins: ler("cofins"), previdencia: ler("previdencia") };
}

export function totalRetido(r: RetencoesFederais): number {
  return Math.round(CAMPOS_DE_RETENCAO.reduce((soma, c) => soma + (r[c] ?? 0), 0) * 100) / 100;
}

export function validarNota(e: EstadoNota, hoje: string): { erros: ErrosNota; valor: number | null } {
  const erros: ErrosNota = {};
  if (!e.cliente) erros.cliente = "Escolha o cliente que emite a nota (o prestador do serviço)";
  if (!e.tomador) erros.tomador = "Escolha o tomador: quem compra o serviço";

  if (!e.competencia) erros.competencia = "Informe a data em que o serviço foi prestado";
  else if (e.competencia > hoje) erros.competencia = "A data não pode ser futura: a competência é a do serviço já prestado";

  if (!/^\d{6}$/.test(e.codigoServico)) erros.servico = "Escolha o serviço prestado";

  const descricao = e.descricao.trim();
  if (!descricao) erros.descricao = "Descreva o serviço prestado";
  else if (descricao.length > descricaoMax(e.canal)) erros.descricao = `Use no máximo ${descricaoMax(e.canal).toLocaleString("pt-BR")} caracteres`;

  const valor = parseDinheiro(e.valor);
  if (valor === null || valor <= 0) erros.valor = "Informe um valor válido, como 1.245,90";
  else if (valor > VALOR_MAXIMO) erros.valor = "O valor é alto demais";

  if (e.informacoes.length > INFORMACOES_MAX) erros.informacoes = `Use no máximo ${INFORMACOES_MAX.toLocaleString("pt-BR")} caracteres`;

  const invalida = CAMPOS_DE_RETENCAO.find((c) => e.retencoes[c].trim() !== "" && parseDinheiro(e.retencoes[c]) === null);
  if (invalida) erros.retencoes = `${ROTULO_RETENCAO[invalida]}: informe um valor válido, como 46,50 (ou deixe vazio)`;
  else if (valor !== null && totalRetido(lerRetencoes(e.retencoes)) > valor) erros.retencoes = "A soma das retenções não pode passar do valor do serviço";
  return { erros, valor };
}

/** CPF/CNPJ e nome de um tomador novo (o servidor continua sendo a autoridade). */
export function validarTomador(t: { documento: string; nome: string; email: string }): { documento?: string; nome?: string; email?: string } {
  const erros: { documento?: string; nome?: string; email?: string } = {};
  if (!documentoValido(t.documento)) erros.documento = "Informe um CPF ou CNPJ válido";
  if (!t.nome.trim()) erros.nome = "Informe o nome ou a razão social";
  else if (t.nome.trim().length > 150) erros.nome = "Use no máximo 150 caracteres";
  const email = t.email.trim();
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 80)) erros.email = "Informe um e-mail válido (ou deixe vazio)";
  return erros;
}

export const ROTULO_CANAL: Record<CanalEmissao, string> = {
  NACIONAL: "Nacional (certificado digital do cliente)",
  MUNICIPAL_SALVADOR: "Municipal de Salvador (sem certificado, pelo portal)",
};

/** O nome curto do canal, para pílulas e linhas de lista. */
export const ROTULO_CANAL_CURTO: Record<CanalEmissao, string> = {
  NACIONAL: "Nacional",
  MUNICIPAL_SALVADOR: "Municipal (Salvador)",
};

/** O aviso que acompanha toda emissão pelo canal municipal: dito na configuração, na revisão e no detalhe da nota. */
export const AVISO_CANAL_MUNICIPAL =
  "Esta nota sai pelo portal da Prefeitura de Salvador, sem certificado, com o usuário e a senha do cliente. É mais lento e menos confiável que o canal nacional: o portal pode pedir captcha, mudar sem aviso ou recusar o acesso, e a senha do cliente fica guardada no sistema.";

export function validarCancelamento(motivo: MotivoCancelamento | null, justificativa: string): { motivo?: string; justificativa?: string } {
  const erros: { motivo?: string; justificativa?: string } = {};
  if (motivo === null) erros.motivo = "Escolha o motivo do cancelamento";
  const tamanho = justificativa.trim().length;
  if (tamanho < JUSTIFICATIVA_MIN) erros.justificativa = `Explique o motivo com pelo menos ${JUSTIFICATIVA_MIN} caracteres (faltam ${JUSTIFICATIVA_MIN - tamanho})`;
  else if (tamanho > JUSTIFICATIVA_MAX) erros.justificativa = `Use no máximo ${JUSTIFICATIVA_MAX} caracteres`;
  return erros;
}

/** Data da segunda linha da lista: a da emissão; enquanto a nota não foi emitida, a competência, dita como tal. */
export function dataDaLinha(nota: Pick<NotaFiscal, "emitidaEm" | "competencia">): string {
  return nota.emitidaEm ? dataDoInstanteBR(nota.emitidaEm) : `competência ${dataBR(nota.competencia)}`;
}

/** Rótulo do campo do formulário a que uma rejeição se refere. */
export const ROTULO_DO_CAMPO: Record<CampoNota, string> = {
  cliente: "Cliente (prestador)",
  tomador: "Tomador",
  competencia: "Data do serviço",
  servico: "Serviço prestado",
  descricao: "Descrição do serviço",
  valor: "Valor do serviço",
  retencao: "Retenções",
  prestador: "Dados fiscais do cliente",
  certificado: "Certificado digital",
};

/** A linha sob o valor, no alto do detalhe: o que aconteceu com a nota e quando. */
export function fraseDaSituacao(n: Pick<NotaFiscal, "status" | "competencia" | "numero" | "emitidaEm" | "historico" | "cancelamento">): string {
  const ultimoEm = (tipo: EventoNota["tipo"]) => [...n.historico].reverse().find((e) => e.tipo === tipo)?.em;
  const em = (instante: string | null | undefined) => (instante ? ` em ${dataHoraBR(instante)}` : "");
  const nfse = n.numero ? ` · NFS-e nº ${n.numero}` : "";
  switch (n.status) {
    case "RASCUNHO":
      return `Rascunho · competência ${dataBR(n.competencia)}`;
    case "ENVIADA":
      return `Enviada${em(ultimoEm("ENVIADA"))} · aguardando o sistema nacional`;
    case "AUTORIZADA":
      return `Emitida${em(n.emitidaEm)}${nfse}`;
    case "REJEITADA":
      return `Rejeitada${em(ultimoEm("REJEITADA"))} · não gerou nota fiscal`;
    case "CANCELADA":
      return `Cancelada${em(n.cancelamento?.canceladaEm)}${nfse}`;
  }
}

// ── Filtro por mês ─────────────────────────────────────────────────────────────────────────────

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-10" → "outubro de 2026". */
export function rotuloDoMes(mes: string): string {
  const [ano, numero] = mes.split("-");
  const nome = MESES[Number(numero) - 1];
  return nome ? `${nome} de ${ano}` : mes;
}

/**
 * Os últimos {@code quantidade} meses (o de {@code hoje} primeiro) para o filtro da lista. Um mês fora desse
 * intervalo que já esteja escolhido (link compartilhado, por exemplo) entra no fim, para o filtro nunca mentir.
 */
export function mesesParaFiltro(hoje: string, quantidade = 12, escolhido = ""): { valor: string; rotulo: string }[] {
  const [ano, mes] = hoje.split("-").map(Number);
  const meses = Array.from({ length: quantidade }, (_, i) => {
    const indice = ano * 12 + (mes - 1) - i;
    const valor = `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, "0")}`;
    return { valor, rotulo: rotuloDoMes(valor) };
  });
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(escolhido) && !meses.some((m) => m.valor === escolhido)) {
    meses.push({ valor: escolhido, rotulo: rotuloDoMes(escolhido) });
  }
  return meses;
}
