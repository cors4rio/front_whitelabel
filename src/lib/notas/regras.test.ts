import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AVISO_CANAL_MUNICIPAL,
  codigoNaMensagem,
  dataDaLinha,
  descricaoPodeSerSugerida,
  descricaoSugerida,
  formatarChaveDeAcesso,
  fraseDaSituacao,
  mesesParaFiltro,
  nomeDoArquivoDaNota,
  nomeSeguroDeArquivo,
  notaCancelavel,
  notaDeTeste,
  notaEditavel,
  notaEmProcessamento,
  OPCOES_STATUS,
  orientacaoParaErro,
  ROTULO_CANAL_CURTO,
  rotuloDoEvento,
  SALVADOR_IBGE,
  rotuloDoMes,
  rotuloDoMotivo,
  lerRetencoes,
  RETENCOES_VAZIAS,
  totalRetido,
  validarCancelamento,
  validarNota,
  validarTomador,
  VALOR_MAXIMO,
  type EstadoNota,
} from "./regras.ts";

const HOJE = "2026-10-21";
const valido: EstadoNota = {
  canal: "NACIONAL",
  cliente: { id: 7 },
  tomador: { id: 3 },
  competencia: HOJE,
  codigoServico: "171901",
  descricao: "Honorários contábeis referentes a 10/2026",
  valor: "1.245,90",
  informacoes: "",
  retencoes: RETENCOES_VAZIAS,
};

describe("situações da nota", () => {
  it("só rascunho e rejeitada se corrigem; só autorizada se cancela; só enviada espera resposta", () => {
    assert.deepEqual(
      (["RASCUNHO", "ENVIADA", "AUTORIZADA", "REJEITADA", "CANCELADA"] as const).map(notaEditavel),
      [true, false, false, true, false],
    );
    assert.deepEqual(
      (["RASCUNHO", "ENVIADA", "AUTORIZADA", "REJEITADA", "CANCELADA"] as const).map(notaCancelavel),
      [false, false, true, false, false],
    );
    assert.equal(notaEmProcessamento("ENVIADA"), true);
    assert.equal(notaEmProcessamento("AUTORIZADA"), false);
  });

  it("o filtro começa por 'todas' e chama a enviada de 'em processamento'", () => {
    assert.equal(OPCOES_STATUS[0].valor, "TODAS");
    assert.equal(OPCOES_STATUS.find((o) => o.valor === "ENVIADA")?.rotulo, "Em processamento");
  });

  it("nota de homologação só merece aviso individual quando o sistema já está em produção", () => {
    assert.equal(notaDeTeste({ ambiente: "HOMOLOGACAO" }, "PRODUCAO"), true);
    assert.equal(notaDeTeste({ ambiente: "HOMOLOGACAO" }, "HOMOLOGACAO"), false);
    assert.equal(notaDeTeste({ ambiente: "PRODUCAO" }, "PRODUCAO"), false);
  });
});

describe("textos", () => {
  it("sugere a descrição dos honorários com mês e ano da competência", () => {
    assert.equal(descricaoSugerida("2026-10-21"), "Honorários contábeis referentes a 10/2026");
    assert.equal(descricaoSugerida(""), "Honorários contábeis");
  });

  it("só oferece trocar a descrição quando ela está vazia ou é uma sugestão de outra competência", () => {
    const sugestao = descricaoSugerida("2026-10-21");
    assert.equal(descricaoPodeSerSugerida("", sugestao), true);
    assert.equal(descricaoPodeSerSugerida("   ", sugestao), true);
    assert.equal(descricaoPodeSerSugerida("Honorários contábeis referentes a 09/2026", sugestao), true);
    assert.equal(descricaoPodeSerSugerida(sugestao, sugestao), false);
    assert.equal(descricaoPodeSerSugerida("Honorários e assessoria fiscal de outubro", sugestao), false);
  });

  it("separa a chave de acesso em blocos de 4 dígitos e ignora o que não é número", () => {
    const chave = "35260312345678000190550010000001231000000017".padEnd(50, "9");
    assert.equal(chave.length, 50);
    const formatada = formatarChaveDeAcesso(chave);
    assert.equal(formatada.replace(/ /g, ""), chave);
    assert.equal(formatada.split(" ").length, 13);
    assert.equal(formatada.split(" ").at(-1)?.length, 2);
    assert.equal(formatarChaveDeAcesso("12 34-56"), "1234 56");
    assert.equal(formatarChaveDeAcesso(null), "");
  });

  it("nome de arquivo sem caracteres proibidos, enxuto e com extensão", () => {
    assert.equal(nomeSeguroDeArquivo('NFS-e 1 - Silva/Souza: "Ltda"', "pdf"), "NFS-e 1 - Silva Souza Ltda.pdf");
    assert.equal(nomeSeguroDeArquivo("   ", "xml"), "NFS-e.xml");
    assert.equal(nomeSeguroDeArquivo("a".repeat(200), "pdf"), `${"a".repeat(80)}.pdf`);
  });

  it("nomeia o arquivo da nota pelo número, ou pelo id enquanto não há número", () => {
    assert.equal(nomeDoArquivoDaNota({ id: 5, numero: "123", prestadorNome: "Marina Ferraz" }, "pdf"), "NFS-e 123 - Marina Ferraz.pdf");
    assert.equal(nomeDoArquivoDaNota({ id: 5, numero: null, prestadorNome: "Marina" }, "xml"), "NFS-e id 5 - Marina.xml");
  });

  it("rotula os eventos da linha do tempo e os motivos de cancelamento", () => {
    assert.equal(rotuloDoEvento({ tipo: "ENVIADA" }), "Enviada para autorização");
    assert.equal(rotuloDoEvento({ tipo: "REJEITADA" }), "Rejeitada pelo sistema nacional");
    assert.equal(rotuloDoMotivo(1), "Erro na emissão");
    assert.equal(rotuloDoMotivo(2), "Serviço não prestado");
    assert.equal(rotuloDoMotivo(9), "Outros");
  });

  it("a data da linha é a da emissão no fuso do escritório; sem emissão, a competência, dita como tal", () => {
    // 01:30 UTC ainda é o dia anterior em Brasília (UTC-3)
    assert.equal(dataDaLinha({ emitidaEm: "2026-10-21T01:30:00Z", competencia: "2026-10-01" }), "20/10/2026");
    assert.equal(dataDaLinha({ emitidaEm: null, competencia: "2026-10-01" }), "competência 01/10/2026");
  });
});

describe("orientação para erros do sistema nacional", () => {
  it("explica o que fazer nos códigos conhecidos, em qualquer caixa", () => {
    assert.match(orientacaoParaErro("E0312") ?? "", /Escolha um serviço/);
    assert.match(orientacaoParaErro("e0016") ?? "", /início do convênio/);
    assert.match(orientacaoParaErro("E0822") ?? "", /análise fiscal/);
  });

  it("não inventa orientação para código desconhecido", () => {
    assert.equal(orientacaoParaErro("E9999"), null);
    assert.equal(orientacaoParaErro(""), null);
  });

  it("lê o código no começo da mensagem que o backend manda", () => {
    assert.equal(codigoNaMensagem("E0822: O prazo para o cancelamento da NFS-e expirou."), "E0822");
    assert.equal(codigoNaMensagem("  E0824: sem tomador"), "E0824");
    assert.equal(codigoNaMensagem("Falhou com E0822 no meio"), null);
    assert.equal(codigoNaMensagem("Algo deu errado."), null);
  });
});

describe("validarNota", () => {
  it("aceita uma nota completa e devolve o valor já numérico", () => {
    const { erros, valor } = validarNota(valido, HOJE);
    assert.deepEqual(erros, {});
    assert.equal(valor, 1245.9);
  });

  it("cobra tudo o que falta, campo a campo", () => {
    const { erros } = validarNota(
      { canal: "NACIONAL", cliente: null, tomador: null, competencia: "", codigoServico: "", descricao: "  ", valor: "", informacoes: "", retencoes: RETENCOES_VAZIAS },
      HOJE,
    );
    assert.deepEqual(Object.keys(erros).sort(), ["cliente", "competencia", "descricao", "servico", "tomador", "valor"]);
    assert.match(erros.cliente!, /prestador/);
    assert.match(erros.tomador!, /quem compra/);
  });

  it("recusa competência no futuro, mas aceita hoje", () => {
    assert.match(validarNota({ ...valido, competencia: "2026-10-22" }, HOJE).erros.competencia ?? "", /futura/);
    assert.equal(validarNota({ ...valido, competencia: HOJE }, HOJE).erros.competencia, undefined);
    assert.equal(validarNota({ ...valido, competencia: "2020-01-31" }, HOJE).erros.competencia, undefined);
  });

  it("o código do serviço tem de ter 6 dígitos", () => {
    assert.ok(validarNota({ ...valido, codigoServico: "17190" }, HOJE).erros.servico);
    assert.ok(validarNota({ ...valido, codigoServico: "17.19.01" }, HOJE).erros.servico);
  });

  it("limita a descrição a 1.000 e as informações complementares a 2.000 caracteres", () => {
    assert.equal(validarNota({ ...valido, descricao: "x".repeat(1000) }, HOJE).erros.descricao, undefined);
    assert.match(validarNota({ ...valido, descricao: "x".repeat(1001) }, HOJE).erros.descricao ?? "", /1\.000/);
    assert.equal(validarNota({ ...valido, informacoes: "y".repeat(2000) }, HOJE).erros.informacoes, undefined);
    assert.match(validarNota({ ...valido, informacoes: "y".repeat(2001) }, HOJE).erros.informacoes ?? "", /2\.000/);
  });

  it("o valor entende o formato brasileiro e recusa zero, negativo, lixo e exagero", () => {
    for (const bom of ["0,01", "199,90", "1.234,56", "R$ 5.000,00", "199.90"]) {
      assert.equal(validarNota({ ...valido, valor: bom }, HOJE).erros.valor, undefined, bom);
    }
    for (const ruim of ["0", "0,00", "-5", "abc", "12,345", ""]) {
      assert.ok(validarNota({ ...valido, valor: ruim }, HOJE).erros.valor, ruim);
    }
    assert.ok(validarNota({ ...valido, valor: String(VALOR_MAXIMO + 1) }, HOJE).erros.valor);
  });
});

describe("retenções federais", () => {
  const com = (retencoes: Partial<typeof RETENCOES_VAZIAS>) => ({ ...valido, valor: "1.000,00", retencoes: { ...RETENCOES_VAZIAS, ...retencoes } });

  it("campos vazios significam sem retenção; o que foi digitado vira número", () => {
    assert.deepEqual(lerRetencoes(RETENCOES_VAZIAS), { irrf: null, csll: null, pis: null, cofins: null, previdencia: null });
    assert.deepEqual(lerRetencoes({ ...RETENCOES_VAZIAS, irrf: "15,00", pis: "6,50" }), { irrf: 15, csll: null, pis: 6.5, cofins: null, previdencia: null });
    assert.equal(totalRetido({ irrf: 15, csll: 10, pis: 6.5, cofins: 30, previdencia: null }), 61.5);
    assert.equal(totalRetido(lerRetencoes(RETENCOES_VAZIAS)), 0);
  });

  it("aceita retenções que cabem no valor do serviço", () => {
    assert.deepEqual(validarNota(com({ irrf: "15,00", csll: "10,00", pis: "6,50", cofins: "30,00" }), HOJE).erros, {});
  });

  it("recusa valor inválido, apontando qual retenção", () => {
    assert.match(validarNota(com({ pis: "abc" }), HOJE).erros.retencoes ?? "", /PIS/);
    assert.match(validarNota(com({ irrf: "1,234" }), HOJE).erros.retencoes ?? "", /IRRF/);
  });

  it("recusa a soma que passa do valor do serviço, mas aceita igualar", () => {
    assert.match(validarNota(com({ irrf: "600,00", cofins: "500,00" }), HOJE).erros.retencoes ?? "", /soma/);
    assert.equal(validarNota(com({ irrf: "600,00", cofins: "400,00" }), HOJE).erros.retencoes, undefined);
  });
});

describe("validarTomador", () => {
  const bom = { documento: "11.222.333/0001-81", nome: "Padaria Pão Quente Ltda", email: "financeiro@padaria.com.br" };

  it("aceita CNPJ ou CPF válido, com nome; o e-mail é opcional", () => {
    assert.deepEqual(validarTomador(bom), {});
    assert.deepEqual(validarTomador({ ...bom, documento: "529.982.247-25", email: "" }), {});
  });

  it("cobra documento válido, nome e e-mail bem formado", () => {
    assert.ok(validarTomador({ ...bom, documento: "11.222.333/0001-82" }).documento);
    assert.ok(validarTomador({ ...bom, documento: "" }).documento);
    assert.ok(validarTomador({ ...bom, nome: "   " }).nome);
    assert.ok(validarTomador({ ...bom, nome: "x".repeat(151) }).nome);
    assert.ok(validarTomador({ ...bom, email: "sem-arroba" }).email);
  });
});

describe("validarCancelamento", () => {
  it("exige motivo e uma justificativa de pelo menos 15 caracteres, contando sem espaços nas pontas", () => {
    assert.deepEqual(Object.keys(validarCancelamento(null, "")).sort(), ["justificativa", "motivo"]);
    assert.match(validarCancelamento(1, "curto demais").justificativa ?? "", /faltam 3/);
    assert.match(validarCancelamento(1, "   quinze     ").justificativa ?? "", /faltam 9/);
    assert.deepEqual(validarCancelamento(1, "Valor digitado errado na emissão"), {});
    assert.deepEqual(validarCancelamento(9, "x".repeat(15)), {});
  });

  it("limita a justificativa a 255 caracteres", () => {
    assert.deepEqual(validarCancelamento(2, "z".repeat(255)), {});
    assert.match(validarCancelamento(2, "z".repeat(256)).justificativa ?? "", /255/);
  });
});

describe("filtro por mês", () => {
  it("escreve o mês por extenso", () => {
    assert.equal(rotuloDoMes("2026-10"), "outubro de 2026");
    assert.equal(rotuloDoMes("2026-03"), "março de 2026");
    assert.equal(rotuloDoMes("lixo"), "lixo");
  });

  it("lista os últimos meses, o atual primeiro, virando o ano", () => {
    const meses = mesesParaFiltro("2026-02-15", 4);
    assert.deepEqual(meses.map((m) => m.valor), ["2026-02", "2026-01", "2025-12", "2025-11"]);
    assert.equal(meses[0].rotulo, "fevereiro de 2026");
    assert.equal(mesesParaFiltro(HOJE).length, 12);
  });

  it("mantém na lista um mês fora do intervalo que já esteja escolhido, e ignora valor inválido", () => {
    assert.equal(mesesParaFiltro(HOJE, 3, "2024-05").at(-1)?.valor, "2024-05");
    assert.equal(mesesParaFiltro(HOJE, 3, "2026-10").length, 3);
    assert.equal(mesesParaFiltro(HOJE, 3, "2026-13").length, 3);
  });
});

describe("fraseDaSituacao", () => {
  const historico = [
    { tipo: "RASCUNHO_CRIADO", em: "2026-10-20T13:00:00Z", por: "Ana", detalhe: null },
    { tipo: "ENVIADA", em: "2026-10-20T13:05:00Z", por: "Ana", detalhe: null },
    { tipo: "REJEITADA", em: "2026-10-20T13:05:03Z", por: null, detalhe: "E0312" },
    { tipo: "ENVIADA", em: "2026-10-21T12:00:00Z", por: "Ana", detalhe: null },
  ] as const;
  const base = { competencia: "2026-10-20", numero: null, emitidaEm: null, historico: [...historico], cancelamento: null };

  it("diz o que aconteceu com a nota e quando, no horário do escritório", () => {
    assert.equal(fraseDaSituacao({ ...base, status: "RASCUNHO" }), "Rascunho · competência 20/10/2026");
    assert.equal(fraseDaSituacao({ ...base, status: "ENVIADA" }), "Enviada em 21/10/2026 às 09:00 · aguardando o sistema nacional");
    assert.equal(fraseDaSituacao({ ...base, status: "REJEITADA" }), "Rejeitada em 20/10/2026 às 10:05 · não gerou nota fiscal");
    assert.equal(fraseDaSituacao({ ...base, status: "AUTORIZADA", numero: "47", emitidaEm: "2026-10-21T12:00:02Z" }), "Emitida em 21/10/2026 às 09:00 · NFS-e nº 47");
    assert.equal(
      fraseDaSituacao({ ...base, status: "CANCELADA", numero: "47", cancelamento: { motivo: 1, justificativa: "x", canceladaEm: "2026-10-22T15:30:00Z", canceladaPorNome: null } }),
      "Cancelada em 22/10/2026 às 12:30 · NFS-e nº 47",
    );
  });

  it("não inventa data que a nota não tem", () => {
    assert.equal(fraseDaSituacao({ ...base, historico: [], status: "ENVIADA" }), "Enviada · aguardando o sistema nacional");
    assert.equal(fraseDaSituacao({ ...base, status: "AUTORIZADA" }), "Emitida");
  });
});

describe("canais de emissão", () => {
  it("a discriminação aceita 1.000 caracteres no nacional e 2.000 no municipal de Salvador", () => {
    const longa = (n: number) => "x".repeat(n);
    assert.equal(validarNota({ ...valido, descricao: longa(1000) }, HOJE).erros.descricao, undefined);
    assert.match(validarNota({ ...valido, descricao: longa(1001) }, HOJE).erros.descricao ?? "", /1\.000/);
    assert.equal(validarNota({ ...valido, canal: "MUNICIPAL_SALVADOR", descricao: longa(2000) }, HOJE).erros.descricao, undefined);
    assert.match(validarNota({ ...valido, canal: "MUNICIPAL_SALVADOR", descricao: longa(2001) }, HOJE).erros.descricao ?? "", /2\.000/);
  });

  it("nomeia os canais e avisa que o municipal é sem certificado", () => {
    assert.equal(ROTULO_CANAL_CURTO.NACIONAL, "Nacional");
    assert.equal(ROTULO_CANAL_CURTO.MUNICIPAL_SALVADOR, "Municipal (Salvador)");
    assert.match(AVISO_CANAL_MUNICIPAL, /sem certificado/);
    assert.equal(SALVADOR_IBGE, "2927408");
  });
});
