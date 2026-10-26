// Estado e dados de partida da simulação do módulo de Notas Fiscais. Nada aqui fala com a Receita nem com o
// backend: é o que o navegador guarda enquanto o módulo real não existe. Tudo o que for regra de negócio da
// emissão mora em servidor.ts; este arquivo é só formato, sementes e a lista "este cliente está pronto?".

import { formatarDocumento, normalizarDocumento } from "../../documento.ts";
import { dataBR, dataHoraBR } from "../../format.ts";
import type {
  AmbienteNfse,
  AtividadeMunicipal,
  CanalDoPerfil,
  CanalEmissao,
  CertificadoInfo,
  EventoNota,
  ItemProntidao,
  NotaFiscal,
  OpcaoSimples,
  PerfilFiscal,
  PortalInfo,
  RegimeEspecial,
  LoteConsulta,
  MovimentoPortal,
  SituacaoProntidao,
  Tomador,
} from "../../types.ts";
import { leituraDaSituacao, municipioPorIbge, rotuloDoMunicipio } from "../municipios.ts";
import { AVISO_CANAL_MUNICIPAL, SALVADOR_IBGE } from "../regras.ts";
import { SERVICO_CONTABIL } from "../servicos.ts";

/** Uma nota como a simulação a guarda: o que a API devolve mais o instante em que a tentativa em curso se resolve. */
export interface NotaGuardada extends NotaFiscal {
  resolverEm: number | null;
}

/** Os dados fiscais de um cliente como a simulação os guarda (o resto vem do cadastro do cliente). */
export interface PerfilGuardado {
  clienteId: number;
  inscricaoMunicipal: string | null;
  municipioIbge: string;
  opcaoSimples: OpcaoSimples;
  regimeEspecial: RegimeEspecial;
  /** O canal padrão do cliente (cada nota pode escolher o seu). */
  canal: CanalEmissao;
  serieDps: number;
  proximoNumeroDps: number;
  servicoPadrao: string | null;
  certificado: CertificadoInfo | null;
  portal: PortalInfo | null;
  /** Atividades do cliente no portal de Salvador, lidas quando o acesso do portal é salvo. */
  atividades: AtividadeMunicipal[];
  /** Quando cada canal teve a conexão testada com sucesso. */
  conexoes: Record<CanalEmissao, string | null>;
}

/** O que a simulação "lê" do portal de Salvador ao salvar o acesso de um cliente (no backend de verdade, vem do portal). */
export const ATIVIDADES_DEMO: AtividadeMunicipal[] = [
  { codigoServico: "171901", ctiss: "1719001", aliquota: 5 },
  { codigoServico: "140101", ctiss: "1401001", aliquota: 5 },
  { codigoServico: "010701", ctiss: "0107001", aliquota: 2 },
];

export const CONEXOES_VAZIAS: Record<CanalEmissao, string | null> = { NACIONAL: null, MUNICIPAL_SALVADOR: null };

export interface ClienteBasico {
  id: number;
  nome: string;
  documento: string;
}

export interface Banco {
  versao: 5;
  proximoId: number;
  proximoIdTomador: number;
  proximoNumeroNfse: number;
  ambiente: AmbienteNfse;
  notas: NotaGuardada[];
  perfis: PerfilGuardado[];
  tomadores: Tomador[];
  /** Consultas ao portal de Salvador (uma por cliente e competência). */
  movimentos: MovimentoPortal[];
  /** A consulta em lote ao portal em andamento ou a última que terminou. */
  lote: LoteGuardado | null;
}

/** O lote como a simulação o guarda: o que a API devolve mais o ritmo (quanto cada cliente "demora") para o tempo andar sozinho. */
export interface LoteGuardado extends Omit<LoteConsulta, "iniciadoEm" | "terminadoEm"> {
  iniciadoEm: string;
  terminadoEm: string | null;
  passoMs: number;
}

export const VERSAO_DO_BANCO = 5;

/** Alíquota de ISS (%) que a simulação aplica a um prestador fora do Simples, só para mostrar um valor. */
export const ALIQUOTA_ISS_DEMO = 2;

const DIA_MS = 86_400_000;

/** Dias inteiros de {@code de} até {@code ate} (ambos AAAA-MM-DD); negativo se {@code ate} é anterior. */
export function diasEntre(de: string, ate: string): number {
  const [a1, m1, d1] = de.split("-").map(Number);
  const [a2, m2, d2] = ate.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / DIA_MS);
}

/** AAAA-MM-DD de {@code data} + {@code dias}. */
export function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

// ── Prontidão ─────────────────────────────────────────────────────────────────────────────────

function item(id: ItemProntidao["id"], titulo: string, situacao: SituacaoProntidao, detalhe: string): ItemProntidao {
  return { id, titulo, situacao, detalhe };
}

const frasePrazo = (dias: number) => (dias === 0 ? "Vence hoje" : dias === 1 ? "Vence amanhã" : `Vence em ${dias} dias`);

const ROTULO_REGIME: Record<OpcaoSimples, string> = { NAO_OPTANTE: "não optante pelo Simples", ME_EPP: "Simples Nacional (ME/EPP)", MEI: "MEI" };

/** CNPJ: a raiz (8 primeiros dígitos) basta, porque o certificado pode ser da matriz; CPF: o documento inteiro. */
function mesmoTitular(documentoDoCertificado: string, documentoDoCliente: string): boolean {
  const a = normalizarDocumento(documentoDoCertificado);
  const b = normalizarDocumento(documentoDoCliente);
  return a.length === 14 && b.length === 14 ? a.slice(0, 8) === b.slice(0, 8) : a === b;
}

/** A lista "este cliente está pronto para emitir por este canal?"; PENDENTE bloqueia, ATENCAO só avisa. */
export function calcularProntidao(
  p: PerfilGuardado | null,
  cliente: ClienteBasico,
  hoje: string,
  canal: CanalEmissao,
): { prontidao: ItemProntidao[]; pronta: boolean } {
  const itens: ItemProntidao[] = [];
  const municipio = p ? municipioPorIbge(p.municipioIbge) : null;

  itens.push(
    p && municipio
      ? item("DADOS", "Dados fiscais do cliente", "OK", `${rotuloDoMunicipio(municipio)} · ${ROTULO_REGIME[p.opcaoSimples]}`)
      : item("DADOS", "Dados fiscais do cliente", "PENDENTE", "Informe o município e o regime tributário deste cliente."),
  );

  if (canal === "MUNICIPAL_SALVADOR") {
    itens.push(
      p?.portal
        ? item("CREDENCIAL", "Acesso ao portal de Salvador", "ATENCAO", `Usuário ${p.portal.usuario}. ${AVISO_CANAL_MUNICIPAL}`)
        : item("CREDENCIAL", "Acesso ao portal de Salvador", "PENDENTE", "Informe o usuário e a senha que o cliente usa no portal da Prefeitura de Salvador."),
    );
    itens.push(
      p && p.municipioIbge === SALVADOR_IBGE
        ? item("MUNICIPIO", "Município atendido pelo canal municipal", "OK", "Salvador: a nota sai pelo portal da prefeitura.")
        : item("MUNICIPIO", "Município atendido pelo canal municipal", "PENDENTE", "O canal municipal só existe para clientes de Salvador."),
    );
  } else {
    if (!p || !p.certificado) {
      itens.push(item("CREDENCIAL", "Certificado digital", "PENDENTE", "Envie o certificado digital A1 deste cliente: sem ele a nota não pode ser assinada."));
    } else if (p.certificado.validoAte < hoje) {
      itens.push(item("CREDENCIAL", "Certificado digital", "PENDENTE", `O certificado venceu em ${dataBR(p.certificado.validoAte)}. Envie o novo.`));
    } else if (!mesmoTitular(p.certificado.cnpj, cliente.documento)) {
      itens.push(item("CREDENCIAL", "Certificado digital", "PENDENTE", `O certificado é de ${formatarDocumento(p.certificado.cnpj)}, não deste cliente. A nota precisa ser assinada com o certificado do próprio prestador.`));
    } else {
      const dias = diasEntre(hoje, p.certificado.validoAte);
      itens.push(
        dias <= 30
          ? item("CREDENCIAL", "Certificado digital", "ATENCAO", `${frasePrazo(dias)} (${dataBR(p.certificado.validoAte)}). Providencie o novo antes disso.`)
          : item("CREDENCIAL", "Certificado digital", "OK", `Válido até ${dataBR(p.certificado.validoAte)} · ${p.certificado.titular}`),
      );
    }

    if (!municipio) {
      itens.push(item("MUNICIPIO", "Município no sistema nacional", "PENDENTE", "Escolha o município do cliente para conferir se ele libera o Emissor Nacional."));
    } else {
      const leitura = leituraDaSituacao(municipio);
      const situacao: SituacaoProntidao = leitura.tom === "ok" ? "OK" : leitura.tom === "problema" ? "PENDENTE" : "ATENCAO";
      itens.push(item("MUNICIPIO", "Município no sistema nacional", situacao, leitura.detalhe));
    }
  }

  const testada = p?.conexoes[canal] ?? null;
  itens.push(
    testada
      ? item("CONEXAO", "Teste de conexão", "OK", `Testada com sucesso em ${dataHoraBR(testada)}.`)
      : item("CONEXAO", "Teste de conexão", "ATENCAO", "Ainda não testada. O teste confirma o acesso e o município deste cliente."),
  );

  return { prontidao: itens, pronta: itens.every((i) => i.situacao !== "PENDENTE") };
}

/** Os canais de um cliente: o nacional sempre; o municipal só se o município dele for Salvador. */
export function canaisDoPerfil(p: PerfilGuardado | null, cliente: ClienteBasico, hoje: string): CanalDoPerfil[] {
  const ehDeSalvador = p !== null && p.municipioIbge === SALVADOR_IBGE;
  return [
    { canal: "NACIONAL", disponivel: true, indisponivelPorque: null, ...calcularProntidao(p, cliente, hoje, "NACIONAL"), conexaoTestadaEm: p?.conexoes.NACIONAL ?? null },
    {
      canal: "MUNICIPAL_SALVADOR",
      disponivel: ehDeSalvador,
      indisponivelPorque: ehDeSalvador ? null : "O canal municipal só existe para clientes de Salvador.",
      ...calcularProntidao(p, cliente, hoje, "MUNICIPAL_SALVADOR"),
      conexaoTestadaEm: p?.conexoes.MUNICIPAL_SALVADOR ?? null,
    },
  ];
}

export function perfilPublico(p: PerfilGuardado | null, cliente: ClienteBasico, hoje: string): PerfilFiscal {
  const municipio = p ? municipioPorIbge(p.municipioIbge) : null;
  const canais = canaisDoPerfil(p, cliente, hoje);
  const padrao = canais.find((c) => c.canal === (p?.canal ?? "NACIONAL"))!;
  return {
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    clienteDocumento: cliente.documento,
    configurado: p !== null,
    inscricaoMunicipal: p?.inscricaoMunicipal ?? null,
    municipioIbge: p?.municipioIbge ?? null,
    municipioNome: municipio?.nome ?? null,
    uf: municipio?.uf ?? null,
    opcaoSimples: p?.opcaoSimples ?? null,
    regimeEspecial: p?.regimeEspecial ?? "NENHUM",
    canal: p?.canal ?? "NACIONAL",
    serieDps: p?.serieDps ?? 1,
    proximoNumeroDps: p?.proximoNumeroDps ?? 1,
    servicoPadrao: p?.servicoPadrao ?? SERVICO_CONTABIL,
    certificado: p?.certificado ?? null,
    portal: p?.portal ?? null,
    atividadesMunicipais: p?.atividades ?? [],
    canais,
    prontidao: padrao.prontidao,
    pronta: padrao.pronta,
  };
}

// ── Sementes ──────────────────────────────────────────────────────────────────────────────────

/** Documentos fictícios com dígito verificador válido, para a tela formatar como formata os reais. */
const PRESTADORES = {
  marina: { nome: "Marina Ferraz Consultoria", documento: "12345678000195" },
  oliveira: { nome: "Oliveira & Andrade Ltda", documento: "23456789000195" },
  thiago: { nome: "Thiago Salgado ME", documento: "34567890000130" },
  rocha: { nome: "Rocha Nunes Advocacia", documento: "45678901000175" },
  camila: { nome: "Camila Prado", documento: "52998224725" },
} as const;

const TOMADORES = {
  aurora: { nome: "Loja Aurora Comércio Ltda", documento: "11444777000161", email: "financeiro@aurora.example" },
  padaria: { nome: "Padaria Pão Quente Ltda", documento: "11222333000181", email: null },
  joao: { nome: "João Pereira", documento: "39053344705", email: "joao.pereira@example.com" },
} as const;

const MUNICIPIO_DEMO = "4106902"; // Curitiba/PR: Emissor Nacional liberado na planilha de adesões

const chaveFicticia = (id: number, numero: string, documento: string, emitidaEm: Date) => {
  const base = `${MUNICIPIO_DEMO}22${documento.padStart(14, "0")}${numero.padStart(13, "0")}${String(emitidaEm.getUTCFullYear()).slice(2)}${String(emitidaEm.getUTCMonth() + 1).padStart(2, "0")}${String(id).padStart(9, "0")}`;
  const dv = [...base].reduce((soma, d) => soma + (/\d/.test(d) ? Number(d) : 0), 0) % 10;
  return `${base}${dv}`;
};

function evento(tipo: EventoNota["tipo"], em: Date, por: string | null, detalhe: string | null = null): EventoNota {
  return { tipo, em: em.toISOString(), por, detalhe };
}

interface Esboco {
  prestador: keyof typeof PRESTADORES;
  tomador: keyof typeof TOMADORES;
  valor: number;
  competenciaDiasAtras: number;
  descricao: string;
  codigoServico?: string;
  /** Há quantos dias a nota foi criada. */
  criadaHa: number;
  situacao: "RASCUNHO" | "AUTORIZADA" | "REJEITADA" | "CANCELADA";
}

const MES = (diasAtras: number, hoje: string) => somarDias(hoje, -diasAtras).slice(5, 7) + "/" + somarDias(hoje, -diasAtras).slice(0, 4);

export const RETENCOES_NENHUMA = { irrf: null, csll: null, pis: null, cofins: null, previdencia: null } as const;

/** Notas de partida, em ordem do mais antigo para o mais novo (o id cresce com o tempo). Sem perfis e sem tomadores. */
export function bancoInicial(agora: Date, hoje: string): Banco {
  const por = "Administrador";
  const esbocos: Esboco[] = [
    { prestador: "camila", tomador: "joao", valor: 1100, competenciaDiasAtras: 62, descricao: `Consultoria referente a ${MES(62, hoje)}`, criadaHa: 62, situacao: "AUTORIZADA" },
    { prestador: "rocha", tomador: "aurora", valor: 2780, competenciaDiasAtras: 41, descricao: `Honorários advocatícios referentes a ${MES(41, hoje)}`, criadaHa: 41, situacao: "AUTORIZADA" },
    { prestador: "thiago", tomador: "padaria", valor: 850, competenciaDiasAtras: 35, descricao: `Serviços prestados em ${MES(35, hoje)}`, criadaHa: 35, situacao: "CANCELADA" },
    { prestador: "marina", tomador: "aurora", valor: 3200, competenciaDiasAtras: 18, descricao: `Consultoria referente a ${MES(18, hoje)}`, criadaHa: 18, situacao: "AUTORIZADA" },
    { prestador: "oliveira", tomador: "padaria", valor: 4500, competenciaDiasAtras: 9, descricao: `Serviços técnicos referentes a ${MES(9, hoje)}`, criadaHa: 9, situacao: "AUTORIZADA" },
    { prestador: "camila", tomador: "joao", valor: 1100, competenciaDiasAtras: 3, descricao: `Consultoria referente a ${MES(3, hoje)}`, criadaHa: 3, situacao: "AUTORIZADA" },
    { prestador: "thiago", tomador: "aurora", valor: 1350, competenciaDiasAtras: 2, descricao: `Serviços prestados em ${MES(2, hoje)}`, codigoServico: "140101", criadaHa: 2, situacao: "REJEITADA" },
    { prestador: "marina", tomador: "padaria", valor: 3200, competenciaDiasAtras: 0, descricao: `Consultoria referente a ${MES(0, hoje)}`, criadaHa: 0, situacao: "RASCUNHO" },
  ];

  let proximoNumero = 41;
  const notas: NotaGuardada[] = esbocos.map((e, indice) => {
    const id = indice + 1;
    const pr = PRESTADORES[e.prestador];
    const t = TOMADORES[e.tomador];
    const criada = new Date(agora.getTime() - e.criadaHa * DIA_MS - (e.criadaHa === 0 ? 20 * 60_000 : 0));
    const enviada = new Date(criada.getTime() + 60_000);
    const resolvida = new Date(criada.getTime() + 75_000);
    const competencia = somarDias(hoje, -e.competenciaDiasAtras);
    const emitida = e.situacao === "AUTORIZADA" || e.situacao === "CANCELADA";
    const numero = emitida ? String(proximoNumero++) : null;

    const historico: EventoNota[] = [evento("RASCUNHO_CRIADO", criada, por)];
    if (e.situacao !== "RASCUNHO") historico.push(evento("ENVIADA", enviada, por));
    if (emitida) historico.push(evento("AUTORIZADA", resolvida, null, `NFS-e nº ${numero}`));
    if (e.situacao === "REJEITADA") historico.push(evento("REJEITADA", resolvida, null, "E0312"));
    const canceladaEm = new Date(resolvida.getTime() + 2 * DIA_MS);
    if (e.situacao === "CANCELADA") historico.push(evento("CANCELADA", canceladaEm, por, "Erro na emissão"));

    return {
      id,
      clienteId: null,
      prestadorNome: pr.nome,
      prestadorDocumento: pr.documento,
      tomadorId: null,
      tomadorNome: t.nome,
      tomadorDocumento: t.documento,
      tomadorEmail: t.email,
      descricaoServico: e.descricao,
      codigoServico: e.codigoServico ?? SERVICO_CONTABIL,
      valor: e.valor,
      competencia,
      issRetido: false,
      retencoes: { ...RETENCOES_NENHUMA },
      informacoesComplementares: null,
      numero,
      status: e.situacao,
      ambiente: "HOMOLOGACAO",
      canal: "NACIONAL",
      emitidaEm: emitida ? resolvida.toISOString() : null,
      createdAt: criada.toISOString(),
      serie: e.situacao === "RASCUNHO" ? null : 1,
      numeroDps: e.situacao === "RASCUNHO" ? null : indice + 1,
      chaveAcesso: emitida ? chaveFicticia(id, numero!, pr.documento, resolvida) : null,
      aliquotaIss: null,
      valorIss: null,
      rejeicoes:
        e.situacao === "REJEITADA"
          ? [
              {
                codigo: "E0312",
                mensagem:
                  "O código de tributação nacional informado não está administrado pelo município de incidência do ISSQN na data de competência informada na DPS.",
                campo: "servico",
              },
            ]
          : [],
      cancelamento:
        e.situacao === "CANCELADA"
          ? {
              motivo: 1,
              justificativa: "Valor digitado errado na emissão; a nota foi refeita com o valor correto.",
              canceladaEm: canceladaEm.toISOString(),
              canceladaPorNome: por,
            }
          : null,
      historico,
      temXml: emitida,
      temPdf: emitida,
      resolverEm: null,
    };
  });

  return {
    versao: VERSAO_DO_BANCO,
    proximoId: notas.length + 1,
    proximoIdTomador: 1,
    proximoNumeroNfse: proximoNumero,
    ambiente: "HOMOLOGACAO",
    notas,
    perfis: [],
    tomadores: [],
    movimentos: [],
    lote: null,
  };
}
