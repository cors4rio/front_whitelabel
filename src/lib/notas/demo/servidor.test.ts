import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError } from "../../api.ts";
import type {
  CancelamentoInput,
  ConfiguracaoFiscal,
  Financeiro,
  LoteConsulta,
  MovimentoPortal,
  NotaFiscal,
  NotaFiscalInput,
  NotaFiscalResumo,
  Pagina,
  PerfilFiscal,
  PerfilFiscalInput,
  PerfilFiscalResumo,
  ResultadoTesteConexao,
  Tomador,
  TomadorInput,
} from "../../types.ts";
import { armazenamentoEmMemoria } from "./armazenamento.ts";
import { ServidorDemo, type ClienteBasico } from "./servidor.ts";

const CLIENTES = new Map<number, ClienteBasico>([
  [7, { id: 7, nome: "Padaria Pão Quente Ltda", documento: "98765432000198" }],
  [8, { id: 8, nome: "João da Silva", documento: "52998224725" }],
]);

/** O financeiro das guias que o backend de verdade devolveria: o cliente 8 deve R$ 100 (vencida) e há R$ 30 pagos no mês. */
function financeiroDasGuias(mes: string): Financeiro {
  return {
    mes,
    guias: { emAberto: 100, quantidadeEmAberto: 1, vencidas: 100, quantidadeVencidas: 1, vencendo: 0, quantidadeVencendo: 0, pagasNoMes: 30, quantidadePagasNoMes: 1, vencidasPagasHoje: 110, vencidasSemEstimativa: 0 },
    emitido: { valor: 0, notas: 0, clientesConsultados: 0, clientesComAcesso: 0, ultimaConsulta: null, guiasQuitadas: 0 },
    serie: ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"].map((m) => ({ mes: m, emitido: 0, pago: m === mes ? 30 : 0 })),
    clientes: [{ clienteId: 8, nome: "João da Silva", consultado: false, emitido: 0, notas: 0, quitadoNoPortal: 0, emAberto: 100, vencido: 100, guiasEmAberto: 1, proximoVencimento: "2026-10-01" }],
  };
}

const SEM_RETENCOES = { irrf: null, csll: null, pis: null, cofins: null, previdencia: null };

/** Curitiba/PR libera o Emissor Nacional; Brasília/DF emite no sistema da prefeitura (situação 1 na planilha de adesões). */
const CURITIBA = "4106902";
const BRASILIA = "5300108";
/** Salvador/BA: na planilha de adesões emite no sistema da prefeitura (situação 1), então só o canal municipal serve. */
const SALVADOR = "2927408";

const perfilBase: PerfilFiscalInput = {
  inscricaoMunicipal: null,
  municipioIbge: CURITIBA,
  opcaoSimples: "ME_EPP",
  regimeEspecial: "NENHUM",
  canal: "NACIONAL",
  serieDps: 1,
  servicoPadrao: null,
};

const tomadorBase: TomadorInput = { documento: "11.444.777/0001-61", nome: "Loja Aurora Comércio Ltda", email: "financeiro@aurora.example" };

function montar(opcoes: { atrasoMs?: number; armazenamento?: ReturnType<typeof armazenamentoEmMemoria> } = {}) {
  let relogio = new Date("2026-10-21T15:00:00.000Z"); // meio-dia em Brasília
  const servidor = new ServidorDemo({
    armazenamento: opcoes.armazenamento ?? armazenamentoEmMemoria(),
    agora: () => relogio,
    hoje: () => "2026-10-21",
    atrasoMs: () => opcoes.atrasoMs ?? 0,
    buscarCliente: async (id) => CLIENTES.get(id) ?? null,
    financeiroDasGuias: async (mes) => financeiroDasGuias(mes || "2026-10"),
    listarClientes: async ({ busca }) => [...CLIENTES.values()].filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase())),
    nomeDoUsuario: async () => "Administrador",
  });

  const salvarPerfil = (clienteId: number, mudancas: Partial<PerfilFiscalInput> = {}) =>
    servidor.chamar<PerfilFiscal>(`/perfis-fiscais/${clienteId}`, { method: "PUT", json: { ...perfilBase, ...mudancas } });
  const enviarCertificado = (clienteId: number, nome: string, senha: string, conteudo = "dados") => {
    const corpo = new FormData();
    corpo.set("arquivo", new File([conteudo], nome));
    corpo.set("senha", senha);
    return servidor.chamar<PerfilFiscal>(`/perfis-fiscais/${clienteId}/certificado`, { method: "PUT", body: corpo });
  };
  const salvarPortal = (clienteId: number, usuario: string, senha: string) =>
    servidor.chamar<PerfilFiscal>(`/perfis-fiscais/${clienteId}/portal`, { method: "PUT", json: { usuario, senha } });
  const criarTomador = (clienteId: number, dados: Partial<TomadorInput> = {}) =>
    servidor.chamar<Tomador>(`/perfis-fiscais/${clienteId}/tomadores`, { method: "POST", json: { ...tomadorBase, ...dados } });

  return {
    servidor,
    avancar: (ms: number) => {
      relogio = new Date(relogio.getTime() + ms);
    },
    perfil: (clienteId: number) => servidor.chamar<PerfilFiscal>(`/perfis-fiscais/${clienteId}`),
    salvarPerfil,
    enviarCertificado,
    salvarPortal,
    criarTomador,
    emitir: (id: number) => servidor.chamar<NotaFiscal>(`/notas-fiscais/${id}/emitir`, { method: "POST" }),
    detalhe: (id: number) => servidor.chamar<NotaFiscal>(`/notas-fiscais/${id}`),
    configuracao: () => servidor.chamar<ConfiguracaoFiscal>("/configuracao-fiscal"),
  };
}

/** O cliente 7 pronto para emitir (dados fiscais + certificado) e com um tomador na lista. */
async function preparar(opcoes: Parameters<typeof montar>[0] = {}) {
  const base = montar(opcoes);
  await base.salvarPerfil(7);
  await base.enviarCertificado(7, "padaria.pfx", "segredo");
  const tomador = await base.criarTomador(7);
  const entrada: NotaFiscalInput = {
    canal: "NACIONAL",
    clienteId: 7,
    tomadorId: tomador.id,
    competencia: "2026-10-20",
    codigoServico: "171901",
    descricaoServico: "Honorários contábeis referentes a 10/2026",
    valor: 1500,
    issRetido: false,
    retencoes: SEM_RETENCOES,
    informacoesComplementares: null,
  };
  return {
    ...base,
    tomador,
    entrada,
    criar: (dados: Partial<NotaFiscalInput> = {}) => base.servidor.chamar<NotaFiscal>("/notas-fiscais", { method: "POST", json: { ...entrada, ...dados } }),
  };
}

async function recusa(promessa: Promise<unknown>): Promise<ApiError> {
  try {
    await promessa;
  } catch (erro) {
    assert.ok(erro instanceof ApiError, `esperava ApiError, veio ${String(erro)}`);
    return erro;
  }
  return assert.fail("esperava uma recusa, mas a chamada passou");
}

const situacaoDe = (perfil: PerfilFiscal, id: string) => perfil.prontidao.find((i) => i.id === id)?.situacao;

describe("lista", () => {
  it("começa com notas de exemplo, as mais recentes primeiro, e pagina", async () => {
    const { servidor } = montar();
    const pagina = await servidor.chamar<Pagina<NotaFiscalResumo>>("/notas-fiscais");
    assert.equal(pagina.totalElements, 8);
    assert.equal(pagina.content[0].status, "RASCUNHO");
    assert.deepEqual(pagina.content.map((n) => n.id), [8, 7, 6, 5, 4, 3, 2, 1]);

    const segunda = await servidor.chamar<Pagina<NotaFiscalResumo>>("/notas-fiscais?page=1&size=3");
    assert.equal(segunda.content.length, 3);
    assert.equal(segunda.totalPages, 3);
    assert.deepEqual(segunda.content.map((n) => n.id), [5, 4, 3]);
  });

  it("filtra por situação, texto (prestador, tomador, documento, número), cliente e mês de competência", async () => {
    const { servidor } = montar();
    const ids = async (consulta: string) => (await servidor.chamar<Pagina<NotaFiscalResumo>>(`/notas-fiscais?${consulta}`)).content.map((n) => n.id).sort();
    assert.deepEqual(await ids("situacao=AUTORIZADA"), [1, 2, 4, 5, 6]);
    assert.deepEqual(await ids("situacao=REJEITADA"), [7]);
    assert.deepEqual(await ids("situacao=CANCELADA"), [3]);
    assert.deepEqual(await ids("situacao=ENVIADA"), []);
    assert.deepEqual(await ids("busca=OLIVEIRA"), [5]);
    assert.deepEqual(await ids("busca=oliveira%20andrade"), [5]);
    assert.deepEqual(await ids("busca=aurora"), [2, 4, 7]); // pelo tomador
    assert.deepEqual(await ids(`busca=${encodeURIComponent("12.345.678/0001-95")}`), [4, 8]); // pelo documento do prestador
    assert.deepEqual(await ids("busca=41"), [1]); // número da nota
    assert.deepEqual(await ids("mes=2026-10"), [4, 5, 6, 7, 8]);
    assert.deepEqual(await ids("clienteId=7"), []); // as de exemplo não pertencem a cliente cadastrado
  });

  it("depois de emitir, a nota aparece na lista do cliente que a emitiu", async () => {
    const { servidor, criar } = await preparar();
    await criar();
    const doCliente = await servidor.chamar<Pagina<NotaFiscalResumo>>("/notas-fiscais?clienteId=7");
    assert.deepEqual(doCliente.content.map((n) => [n.prestadorNome, n.tomadorNome]), [["Padaria Pão Quente Ltda", "Loja Aurora Comércio Ltda"]]);
    assert.equal((await servidor.chamar<Pagina<NotaFiscalResumo>>("/notas-fiscais?clienteId=8")).totalElements, 0);
  });
});

describe("rascunho", () => {
  it("cria com prestador e tomador copiados dos cadastros e cobra os campos inválidos um a um", async () => {
    const { servidor, criar } = await preparar();
    const nota = await criar();
    assert.equal(nota.status, "RASCUNHO");
    assert.equal(nota.prestadorNome, "Padaria Pão Quente Ltda");
    assert.equal(nota.prestadorDocumento, "98765432000198");
    assert.equal(nota.tomadorNome, "Loja Aurora Comércio Ltda");
    assert.equal(nota.tomadorDocumento, "11444777000161");
    assert.equal(nota.tomadorEmail, "financeiro@aurora.example");
    assert.equal(nota.canal, "NACIONAL");
    assert.deepEqual(nota.historico.map((e) => e.tipo), ["RASCUNHO_CRIADO"]);
    assert.equal(nota.historico[0].por, "Administrador");
    assert.equal(nota.numero, null);

    const erro = await recusa(
      servidor.chamar("/notas-fiscais", {
        method: "POST",
        json: { canal: "NACIONAL", clienteId: 999, tomadorId: 999, competencia: "2026-10-22", codigoServico: "123", descricaoServico: " ", valor: 0, issRetido: false, retencoes: SEM_RETENCOES, informacoesComplementares: null },
      }),
    );
    assert.equal(erro.status, 400);
    assert.deepEqual(Object.keys(erro.campos).sort(), ["clienteId", "codigoServico", "competencia", "descricaoServico", "tomadorId", "valor"]);
  });

  it("o tomador tem de ser da lista do próprio cliente", async () => {
    const { servidor, criarTomador, criar } = await preparar();
    const deOutroCliente = await criarTomador(8, { documento: "39053344705", nome: "João Pereira", email: null });
    const erro = await recusa(criar({ tomadorId: deOutroCliente.id }));
    assert.equal(erro.status, 400);
    assert.match(erro.campos.tomadorId, /lista deste cliente/);
    assert.equal((await servidor.chamar<Pagina<NotaFiscalResumo>>("/notas-fiscais")).totalElements, 8);
  });

  it("guarda as retenções federais e recusa valores negativos ou que passam do valor do serviço", async () => {
    const { criar } = await preparar();
    const nota = await criar({ retencoes: { irrf: 22.5, csll: 15, pis: 9.75, cofins: 45, previdencia: null } });
    assert.deepEqual(nota.retencoes, { irrf: 22.5, csll: 15, pis: 9.75, cofins: 45, previdencia: null });

    const negativa = await recusa(criar({ retencoes: { ...SEM_RETENCOES, pis: -1 } }));
    assert.ok(negativa.campos.retencoes);
    const alta = await recusa(criar({ valor: 100, retencoes: { ...SEM_RETENCOES, irrf: 60, cofins: 50 } }));
    assert.match(alta.campos.retencoes, /soma/);
    assert.equal((await criar({ valor: 100, retencoes: { ...SEM_RETENCOES, irrf: 60, cofins: 40 } })).status, "RASCUNHO");
  });

  it("edita e exclui enquanto é rascunho", async () => {
    const { servidor, criar, detalhe, entrada } = await preparar();
    const nota = await criar();
    const editada = await servidor.chamar<NotaFiscal>(`/notas-fiscais/${nota.id}`, { method: "PUT", json: { ...entrada, valor: 2000, retencoes: { ...SEM_RETENCOES, irrf: 30 } } });
    assert.equal(editada.valor, 2000);
    assert.equal(editada.retencoes.irrf, 30);
    assert.deepEqual(editada.historico.map((e) => e.tipo), ["RASCUNHO_CRIADO", "EDITADA"]);

    await servidor.chamar(`/notas-fiscais/${nota.id}`, { method: "DELETE" });
    assert.equal((await recusa(detalhe(nota.id))).status, 404);
  });

  it("nota que já saiu não se edita nem se exclui", async () => {
    const { servidor, criar, emitir, entrada } = await preparar();
    const emitida = await emitir((await criar()).id);
    assert.equal(emitida.status, "AUTORIZADA");
    assert.equal((await recusa(servidor.chamar(`/notas-fiscais/${emitida.id}`, { method: "PUT", json: entrada }))).status, 409);
    const erro = await recusa(servidor.chamar(`/notas-fiscais/${emitida.id}`, { method: "DELETE" }));
    assert.equal(erro.status, 409);
    assert.match(erro.message, /cancele-a/);
  });
});

describe("emissão", () => {
  it("autoriza: numera a nota, gera a chave de 50 dígitos e libera XML e PDF", async () => {
    const { criar, emitir, perfil } = await preparar();
    const antes = await perfil(7);
    const nota = await emitir((await criar()).id);

    assert.equal(nota.status, "AUTORIZADA");
    assert.equal(nota.numero, "47"); // as de exemplo usaram de 41 a 46
    assert.equal(nota.serie, 1);
    assert.equal(nota.numeroDps, antes.proximoNumeroDps);
    assert.match(nota.chaveAcesso ?? "", /^\d{50}$/);
    assert.equal(nota.ambiente, "HOMOLOGACAO");
    assert.equal(nota.canal, "NACIONAL");
    assert.equal(nota.temXml && nota.temPdf, true);
    assert.deepEqual(nota.historico.map((e) => e.tipo), ["RASCUNHO_CRIADO", "ENVIADA", "AUTORIZADA"]);
    assert.equal(nota.historico[2].por, null); // quem autoriza é o sistema, não uma pessoa
    assert.equal((await perfil(7)).proximoNumeroDps, antes.proximoNumeroDps + 1);
  });

  it("a numeração da DPS é de cada cliente", async () => {
    const { criar, emitir, perfil, salvarPerfil, enviarCertificado, criarTomador } = await preparar();
    await salvarPerfil(8);
    await enviarCertificado(8, "joao.pfx", "segredo");
    const tomador8 = await criarTomador(8, { documento: "39053344705", nome: "João Pereira", email: null });

    await emitir((await criar()).id);
    await emitir((await criar()).id);
    assert.equal((await perfil(7)).proximoNumeroDps, 3);
    assert.equal((await perfil(8)).proximoNumeroDps, 1);

    const nota8 = await emitir(
      (
        await criar({ clienteId: 8, tomadorId: tomador8.id })
      ).id,
    );
    assert.equal(nota8.numeroDps, 1);
    assert.equal(nota8.prestadorNome, "João da Silva");
    assert.equal((await perfil(8)).proximoNumeroDps, 2);
  });

  it("no Simples o ISS segue no DAS; fora dele a simulação mostra alíquota e valor", async () => {
    const { criar, emitir, salvarPerfil } = await preparar();
    const simples = await emitir((await criar()).id);
    assert.equal(simples.aliquotaIss, null);
    assert.equal(simples.valorIss, null);

    await salvarPerfil(7, { opcaoSimples: "NAO_OPTANTE" });
    const geral = await emitir((await criar({ valor: 1000 })).id);
    assert.equal(geral.aliquotaIss, 2);
    assert.equal(geral.valorIss, 20);
  });

  it("fica 'enviada' durante o tempo de espera e se resolve sozinha depois (sem timer: ao perguntar)", async () => {
    const { criar, emitir, detalhe, avancar } = await preparar({ atrasoMs: 2500 });
    const enviada = await emitir((await criar()).id);
    assert.equal(enviada.status, "ENVIADA");
    assert.equal(enviada.numero, null);

    avancar(2499);
    assert.equal((await detalhe(enviada.id)).status, "ENVIADA");
    avancar(1);
    const autorizada = await detalhe(enviada.id);
    assert.equal(autorizada.status, "AUTORIZADA");
    assert.equal(autorizada.emitidaEm, "2026-10-21T15:00:02.500Z"); // o instante em que se resolveria, não o de quem perguntou
  });

  it("pelo canal municipal a espera é o triplo", async () => {
    const { criar, emitir, detalhe, avancar, salvarPerfil, salvarPortal } = await preparar({ atrasoMs: 1000 });
    await salvarPerfil(7, { municipioIbge: SALVADOR, canal: "MUNICIPAL_SALVADOR" });
    await salvarPortal(7, "98765432000198", "senha-do-portal");
    const enviada = await emitir((await criar({ canal: "MUNICIPAL_SALVADOR" })).id);
    assert.equal(enviada.status, "ENVIADA");
    assert.equal(enviada.canal, "MUNICIPAL_SALVADOR");

    avancar(2999);
    assert.equal((await detalhe(enviada.id)).status, "ENVIADA");
    avancar(1);
    const autorizada = await detalhe(enviada.id);
    assert.equal(autorizada.status, "AUTORIZADA");
    assert.equal(autorizada.canal, "MUNICIPAL_SALVADOR");
  });

  it("não deixa emitir duas vezes", async () => {
    const { criar, emitir } = await preparar();
    const nota = await emitir((await criar()).id);
    assert.match((await recusa(emitir(nota.id))).message, /já foi enviada/);
  });

  it("bloqueia a emissão de um cliente sem dados fiscais, dizendo o que falta", async () => {
    const { criar, criarTomador, emitir } = await preparar();
    const tomador8 = await criarTomador(8, { documento: "39053344705", nome: "João Pereira", email: null });
    const rascunho = await criar({ clienteId: 8, tomadorId: tomador8.id });
    const erro = await recusa(emitir(rascunho.id));
    assert.equal(erro.status, 409);
    assert.match(erro.message, /João da Silva ainda não está pronta/);
    assert.match(erro.message, /município/);
  });

  it("bloqueia sem certificado, com certificado de outro CNPJ e com certificado vencido", async () => {
    const { servidor, criar, emitir, enviarCertificado } = await preparar();
    const rascunho = await criar();

    await servidor.chamar("/perfis-fiscais/7/certificado", { method: "DELETE" });
    const sem = await recusa(emitir(rascunho.id));
    assert.equal(sem.status, 409);
    assert.match(sem.message, /certificado digital A1/);

    await enviarCertificado(7, "de outro cnpj.p12", "segredo");
    assert.match((await recusa(emitir(rascunho.id))).message, /não deste cliente/);

    await enviarCertificado(7, "meu vencido.pfx", "segredo");
    assert.match((await recusa(emitir(rascunho.id))).message, /venceu/);

    await enviarCertificado(7, "novo.pfx", "segredo");
    assert.equal((await emitir(rascunho.id)).status, "AUTORIZADA");
  });
});

describe("rejeição e reemissão", () => {
  it("rejeita serviço que o município não administra, com o código e o texto oficiais, e aceita a correção", async () => {
    const { servidor, criar, emitir, detalhe, entrada } = await preparar();
    const rejeitada = await emitir((await criar({ codigoServico: "140101" })).id);
    assert.equal(rejeitada.status, "REJEITADA");
    assert.equal(rejeitada.rejeicoes[0].codigo, "E0312");
    assert.equal(rejeitada.rejeicoes[0].campo, "servico");
    assert.match(rejeitada.rejeicoes[0].mensagem, /não está administrado pelo município/);
    assert.equal(rejeitada.numero, null);
    assert.equal(rejeitada.temPdf, false);

    // corrige e reemite: a mesma nota, outra tentativa
    await servidor.chamar(`/notas-fiscais/${rejeitada.id}`, { method: "PUT", json: { ...entrada, codigoServico: "171901" } });
    const ainda = await detalhe(rejeitada.id);
    assert.equal(ainda.status, "REJEITADA"); // editar não reenvia
    const autorizada = await emitir(rejeitada.id);
    assert.equal(autorizada.status, "AUTORIZADA");
    assert.deepEqual(autorizada.rejeicoes, []);
    assert.ok(autorizada.numeroDps! > rejeitada.numeroDps!, "cada tentativa usa um número de DPS novo");
    assert.deepEqual(autorizada.historico.map((e) => e.tipo), ["RASCUNHO_CRIADO", "ENVIADA", "REJEITADA", "EDITADA", "ENVIADA", "AUTORIZADA"]);
  });

  it("rejeita competência anterior ao convênio do município", async () => {
    const { criar, emitir } = await preparar();
    const nota = await emitir((await criar({ competencia: "2025-04-30" })).id);
    assert.equal(nota.status, "REJEITADA");
    assert.equal(nota.rejeicoes[0].codigo, "E1270");
    assert.equal(nota.rejeicoes[0].campo, "competencia");
  });

  it("rejeita ISS retido quando o prestador tem regime especial, e junta vários motivos", async () => {
    const { criar, emitir, salvarPerfil } = await preparar();
    await salvarPerfil(7, { regimeEspecial: "SOCIEDADE_PROFISSIONAIS" });
    const nota = await emitir((await criar({ issRetido: true, codigoServico: "140101" })).id);
    assert.deepEqual(nota.rejeicoes.map((e) => e.codigo), ["E0312", "E0588"]);
    assert.equal(nota.rejeicoes[1].campo, "retencao");
  });

  it("rejeita ISS retido para MEI", async () => {
    const { criar, emitir, salvarPerfil } = await preparar();
    await salvarPerfil(7, { opcaoSimples: "MEI" });
    const nota = await emitir((await criar({ issRetido: true })).id);
    assert.deepEqual(nota.rejeicoes.map((e) => e.codigo), ["E0583"]);
  });

  it("pelo canal municipal o captcha pode barrar a emissão, e uma nova tentativa passa", async () => {
    const { servidor, criar, emitir, salvarPerfil, salvarPortal, entrada } = await preparar();
    await salvarPerfil(7, { municipioIbge: SALVADOR, canal: "MUNICIPAL_SALVADOR" });
    await salvarPortal(7, "98765432000198", "senha-do-portal");
    const barrada = await emitir((await criar({ canal: "MUNICIPAL_SALVADOR", descricaoServico: "Teste de captcha" })).id);
    assert.equal(barrada.status, "REJEITADA");
    assert.equal(barrada.rejeicoes[0].codigo, "PORTAL01");
    assert.equal(barrada.rejeicoes[0].campo, null);

    await servidor.chamar(`/notas-fiscais/${barrada.id}`, { method: "PUT", json: { ...entrada, canal: "MUNICIPAL_SALVADOR" } });
    assert.equal((await emitir(barrada.id)).status, "AUTORIZADA");
  });

  it("as regras do sistema nacional (serviço, convênio) não valem no canal municipal", async () => {
    const { criar, emitir, salvarPerfil, salvarPortal } = await preparar();
    await salvarPerfil(7, { municipioIbge: SALVADOR, canal: "MUNICIPAL_SALVADOR" });
    await salvarPortal(7, "98765432000198", "senha-do-portal");
    const municipal = await emitir((await criar({ canal: "MUNICIPAL_SALVADOR", codigoServico: "140101", competencia: "2025-04-30" })).id);
    assert.equal(municipal.status, "AUTORIZADA"); // 14.01.01 e competência antiga só barram no nacional
  });
});

describe("cancelamento", () => {
  const cancelamento: CancelamentoInput = { motivo: 1, justificativa: "Valor digitado errado na emissão" };

  it("cancela uma nota autorizada, registrando motivo, justificativa e quem cancelou", async () => {
    const { servidor, criar, emitir } = await preparar();
    const nota = await emitir((await criar()).id);
    const cancelada = await servidor.chamar<NotaFiscal>(`/notas-fiscais/${nota.id}/cancelar`, { method: "POST", json: cancelamento });
    assert.equal(cancelada.status, "CANCELADA");
    assert.equal(cancelada.cancelamento?.motivo, 1);
    assert.equal(cancelada.cancelamento?.canceladaPorNome, "Administrador");
    assert.equal(cancelada.historico.at(-1)?.tipo, "CANCELADA");
    assert.equal(cancelada.temXml, true, "o XML da nota continua disponível");
    assert.equal((await recusa(servidor.chamar(`/notas-fiscais/${nota.id}/cancelar`, { method: "POST", json: cancelamento }))).status, 409);
  });

  it("cobra motivo e justificativa de 15 a 255 caracteres", async () => {
    const { servidor, criar, emitir } = await preparar();
    const nota = await emitir((await criar()).id);
    const rota = `/notas-fiscais/${nota.id}/cancelar`;
    const curta = await recusa(servidor.chamar(rota, { method: "POST", json: { motivo: 1, justificativa: "curta" } }));
    assert.equal(curta.status, 400);
    assert.ok(curta.campos.justificativa);
    const semMotivo = await recusa(servidor.chamar(rota, { method: "POST", json: { motivo: 5, justificativa: "x".repeat(20) } }));
    assert.ok(semMotivo.campos.motivo);
    const longa = await recusa(servidor.chamar(rota, { method: "POST", json: { motivo: 9, justificativa: "x".repeat(256) } }));
    assert.ok(longa.campos.justificativa);
  });

  it("recusa com o código E0822 depois do prazo do município, e só cancela nota autorizada", async () => {
    const { servidor } = montar();
    const velha = await recusa(servidor.chamar("/notas-fiscais/1/cancelar", { method: "POST", json: cancelamento }));
    assert.equal(velha.status, 422);
    assert.match(velha.message, /^E0822: O prazo para o cancelamento/);

    const rascunho = await recusa(servidor.chamar("/notas-fiscais/8/cancelar", { method: "POST", json: cancelamento }));
    assert.equal(rascunho.status, 409);
  });

  it("dentro do prazo ainda cancela, e no último dia de prazo também", async () => {
    const { servidor, criar, emitir, avancar } = await preparar();
    const nota = await emitir((await criar()).id);
    avancar(30 * 86_400_000);
    assert.equal((await servidor.chamar<NotaFiscal>(`/notas-fiscais/${nota.id}/cancelar`, { method: "POST", json: cancelamento })).status, "CANCELADA");

    const outra = await emitir((await criar()).id);
    avancar(30 * 86_400_000 + 1);
    assert.equal((await recusa(servidor.chamar(`/notas-fiscais/${outra.id}/cancelar`, { method: "POST", json: cancelamento }))).status, 422);
  });
});

describe("arquivos", () => {
  it("entrega XML e PDF de demonstração da nota autorizada e recusa a que ainda não os tem", async () => {
    const { servidor } = montar();
    const xml = await servidor.chamarBlob("/notas-fiscais/4/xml");
    const texto = await xml.text();
    assert.match(texto, /<NFSe /);
    assert.match(texto, /DEMONSTRAÇÃO/);
    assert.match(texto, /<xNome>Marina Ferraz Consultoria<\/xNome>/); // o prestador
    assert.match(texto, /<xNome>Loja Aurora Comércio Ltda<\/xNome>/); // o tomador

    const pdf = new Uint8Array(await (await servidor.chamarBlob("/notas-fiscais/4/pdf")).arrayBuffer());
    assert.equal(String.fromCharCode(...pdf.slice(0, 5)), "%PDF-");

    assert.equal((await recusa(servidor.chamarBlob("/notas-fiscais/8/pdf"))).status, 404);
    assert.equal((await recusa(servidor.chamarBlob("/notas-fiscais/7/xml"))).status, 404);
  });

  it("o XML leva as retenções federais da nota", async () => {
    const { servidor, criar, emitir } = await preparar();
    const nota = await emitir((await criar({ retencoes: { irrf: 22.5, csll: null, pis: 9.75, cofins: null, previdencia: null } })).id);
    const texto = await (await servidor.chamarBlob(`/notas-fiscais/${nota.id}/xml`)).text();
    assert.match(texto, /vRetIRRF/);
    assert.match(texto, /vPis/);
    assert.doesNotMatch(texto, /vRetCSLL/);
  });
});

describe("ambiente do escritório", () => {
  it("começa em homologação e só aceita os dois ambientes", async () => {
    const { servidor, configuracao } = montar();
    assert.equal((await configuracao()).ambiente, "HOMOLOGACAO");
    const erro = await recusa(servidor.chamar("/configuracao-fiscal", { method: "PUT", json: { ambiente: "OUTRO" } }));
    assert.equal(erro.status, 400);
    assert.ok(erro.campos.ambiente);
  });

  it("trocar de ambiente vale para todos os clientes e pede novo teste de conexão em cada um", async () => {
    const { servidor, criar, emitir, configuracao, perfil } = await preparar();
    const teste = await servidor.chamar<ResultadoTesteConexao>("/perfis-fiscais/7/testar-conexao", { method: "POST" });
    assert.equal(teste.ok, true);
    assert.equal(situacaoDe(await perfil(7), "CONEXAO"), "OK");

    await servidor.chamar("/configuracao-fiscal", { method: "PUT", json: { ambiente: "PRODUCAO" } });
    assert.equal((await configuracao()).ambiente, "PRODUCAO");
    assert.equal(situacaoDe(await perfil(7), "CONEXAO"), "ATENCAO");
    assert.equal((await emitir((await criar()).id)).ambiente, "PRODUCAO");
  });
});

describe("dados fiscais por cliente", () => {
  it("um cliente sem dados começa pendente, sem inventar nada", async () => {
    const { perfil } = montar();
    const p = await perfil(7);
    assert.equal(p.configurado, false);
    assert.equal(p.pronta, false);
    assert.equal(p.clienteNome, "Padaria Pão Quente Ltda");
    assert.equal(p.municipioIbge, null);
    assert.equal(p.certificado, null);
    assert.deepEqual(p.prontidao.map((i) => `${i.id}:${i.situacao}`), ["DADOS:PENDENTE", "CREDENCIAL:PENDENTE", "MUNICIPIO:PENDENTE", "CONEXAO:ATENCAO"]);
  });

  it("cliente que não existe é 404", async () => {
    const { perfil, servidor } = montar();
    assert.equal((await recusa(perfil(999))).status, 404);
    assert.equal((await recusa(servidor.chamar("/perfis-fiscais/999", { method: "PUT", json: perfilBase }))).status, 404);
  });

  it("salvar os dados deixa só a credencial por fazer; depois do certificado, o cliente está pronto", async () => {
    const { perfil, salvarPerfil, enviarCertificado } = montar();
    const salvo = await salvarPerfil(7);
    assert.equal(salvo.configurado, true);
    assert.equal(salvo.municipioNome, "Curitiba");
    assert.equal(salvo.uf, "PR");
    assert.equal(salvo.serieDps, 1);
    assert.equal(salvo.proximoNumeroDps, 1);
    assert.deepEqual(salvo.prontidao.map((i) => `${i.id}:${i.situacao}`), ["DADOS:OK", "CREDENCIAL:PENDENTE", "MUNICIPIO:OK", "CONEXAO:ATENCAO"]);
    assert.equal(salvo.pronta, false);

    await enviarCertificado(7, "padaria.pfx", "segredo");
    assert.equal((await perfil(7)).pronta, true);
  });

  it("cobra os campos inválidos", async () => {
    const { servidor } = montar();
    const mandar = (json: unknown) => recusa(servidor.chamar("/perfis-fiscais/7", { method: "PUT", json }));
    const erro = await mandar({ ...perfilBase, municipioIbge: "0000000", opcaoSimples: "", canal: "OUTRO", serieDps: 0 });
    assert.equal(erro.status, 400);
    assert.deepEqual(Object.keys(erro.campos).sort(), ["canal", "municipioIbge", "opcaoSimples", "serieDps"]);
    assert.ok((await mandar({ ...perfilBase, serieDps: 50000 })).campos.serieDps);
    assert.ok((await mandar({ ...perfilBase, inscricaoMunicipal: "1".repeat(16) })).campos.inscricaoMunicipal);
    assert.ok((await mandar({ ...perfilBase, servicoPadrao: "999999" })).campos.servicoPadrao);
  });

  it("mudar a série recomeça a numeração; mudar outra coisa não", async () => {
    const { criar, emitir, perfil, salvarPerfil } = await preparar();
    await emitir((await criar()).id);
    assert.equal((await perfil(7)).proximoNumeroDps, 2);
    await salvarPerfil(7, { inscricaoMunicipal: "12345" });
    assert.equal((await perfil(7)).proximoNumeroDps, 2);
    await salvarPerfil(7, { serieDps: 2 });
    assert.equal((await perfil(7)).proximoNumeroDps, 1);
  });

  it("município que emite no sistema da prefeitura trava o canal nacional", async () => {
    const { criar, emitir, salvarPerfil } = await preparar();
    const rascunho = await criar();

    const travado = await salvarPerfil(7, { municipioIbge: BRASILIA });
    assert.equal(travado.pronta, false);
    assert.equal(situacaoDe(travado, "MUNICIPIO"), "PENDENTE");
    assert.match((await recusa(emitir(rascunho.id))).message, /Emissor Nacional/);
  });

  it("cliente de Salvador tem os dois canais: o nacional trava e o municipal emite, e cada nota escolhe o seu", async () => {
    const { criar, emitir, salvarPerfil, salvarPortal, perfil } = await preparar();
    await salvarPerfil(7, { municipioIbge: SALVADOR, canal: "NACIONAL" });
    await salvarPortal(7, "98765432000198", "senha-do-portal");

    const p = await perfil(7);
    assert.deepEqual(p.canais.map((c) => `${c.canal}:${c.disponivel}:${c.pronta}`), ["NACIONAL:true:false", "MUNICIPAL_SALVADOR:true:true"]);
    assert.equal(p.pronta, false); // o canal padrão é o nacional
    assert.deepEqual(p.atividadesMunicipais.map((a) => a.codigoServico), ["171901", "140101", "010701"]);

    assert.match((await recusa(emitir((await criar()).id))).message, /Emissor Nacional/);
    const nota = await emitir((await criar({ canal: "MUNICIPAL_SALVADOR" })).id);
    assert.equal(nota.status, "AUTORIZADA");
    assert.equal(nota.canal, "MUNICIPAL_SALVADOR");
  });

  it("o canal municipal só existe para clientes de Salvador", async () => {
    const { criar, salvarPerfil, salvarPortal, perfil } = await preparar();
    const p = await perfil(7);
    assert.equal(p.canais.find((c) => c.canal === "MUNICIPAL_SALVADOR")?.disponivel, false);
    assert.match(p.canais.find((c) => c.canal === "MUNICIPAL_SALVADOR")?.indisponivelPorque ?? "", /Salvador/);

    assert.ok((await recusa(salvarPerfil(7, { canal: "MUNICIPAL_SALVADOR" }))).campos.canal);
    assert.equal((await recusa(salvarPortal(7, "usuario", "senha"))).status, 409);
    assert.ok((await recusa(criar({ canal: "MUNICIPAL_SALVADOR" }))).campos.canal);
  });

  it("no canal municipal o serviço é uma atividade do cliente e a discriminação aceita 2.000 caracteres", async () => {
    const { criar, salvarPerfil, salvarPortal } = await preparar();
    await salvarPerfil(7, { municipioIbge: SALVADOR, canal: "MUNICIPAL_SALVADOR" });
    await salvarPortal(7, "98765432000198", "senha-do-portal");

    const fora = await recusa(criar({ canal: "MUNICIPAL_SALVADOR", codigoServico: "070201" }));
    assert.match(fora.campos.codigoServico, /atividades do cliente/);

    assert.equal((await criar({ canal: "MUNICIPAL_SALVADOR", descricaoServico: "x".repeat(2000) })).status, "RASCUNHO");
    assert.match((await recusa(criar({ canal: "MUNICIPAL_SALVADOR", descricaoServico: "x".repeat(2001) }))).campos.descricaoServico, /2000/);
    assert.match((await recusa(criar({ canal: "NACIONAL", descricaoServico: "x".repeat(1001) }))).campos.descricaoServico, /1000/);
  });

  it("lista os clientes com a situação de cada um e filtra por ela", async () => {
    const { servidor, salvarPerfil, enviarCertificado } = montar();
    const ids = async (consulta = "") => (await servidor.chamar<Pagina<PerfilFiscalResumo>>(`/perfis-fiscais?${consulta}`)).content.map((p) => p.clienteId).sort();
    assert.deepEqual(await ids(), [7, 8]);
    assert.deepEqual(await ids("situacao=NAO_CONFIGURADOS"), [7, 8]);

    await salvarPerfil(7);
    assert.deepEqual(await ids("situacao=NAO_CONFIGURADOS"), [8]);
    assert.deepEqual(await ids("situacao=PENDENTES"), [7]);
    assert.deepEqual(await ids("situacao=PRONTOS"), []);

    await enviarCertificado(7, "padaria.pfx", "segredo");
    assert.deepEqual(await ids("situacao=PRONTOS"), [7]);
    assert.deepEqual(await ids("situacao=PENDENTES"), []);
    assert.deepEqual(await ids("busca=padaria"), [7]);

    const resumo = (await servidor.chamar<Pagina<PerfilFiscalResumo>>("/perfis-fiscais?busca=padaria")).content[0];
    assert.deepEqual(resumo, {
      clienteId: 7,
      clienteNome: "Padaria Pão Quente Ltda",
      clienteDocumento: "98765432000198",
      configurado: true,
      municipioNome: "Curitiba",
      uf: "PR",
      canal: "NACIONAL",
      pronta: true,
    });
  });
});

describe("credenciais", () => {
  it("exige os dados fiscais antes de aceitar certificado ou acesso ao portal", async () => {
    const { enviarCertificado, salvarPortal } = montar();
    assert.equal((await recusa(enviarCertificado(7, "padaria.pfx", "segredo"))).status, 409);
    assert.equal((await recusa(salvarPortal(7, "usuario", "senha"))).status, 409);
  });

  it("certificado: valida arquivo e senha, e reconhece vencido e de outro CNPJ", async () => {
    const { perfil, salvarPerfil, enviarCertificado } = montar();
    await salvarPerfil(7);
    const credencial = async () => (await perfil(7)).prontidao.find((i) => i.id === "CREDENCIAL")!;

    assert.ok((await recusa(enviarCertificado(7, "certificado.txt", "123"))).campos.arquivo);
    assert.ok((await recusa(enviarCertificado(7, "certificado.pfx", ""))).campos.senha);
    assert.equal((await recusa(enviarCertificado(7, "certificado.pfx", "errada"))).status, 422);
    assert.ok((await recusa(enviarCertificado(7, "certificado.pfx", "123", ""))).campos.arquivo);

    assert.equal((await enviarCertificado(7, "meu vencido.pfx", "123")).pronta, false);
    assert.equal((await credencial()).situacao, "PENDENTE");
    assert.match((await credencial()).detalhe, /venceu/);
    assert.equal((await enviarCertificado(7, "de outro cnpj.p12", "123")).pronta, false);
    assert.match((await credencial()).detalhe, /99\.999\.999\/0001-91/);

    const ok = await enviarCertificado(7, "padaria.PFX", "segredo");
    assert.equal(ok.pronta, true);
    assert.equal(ok.certificado?.cnpj, "98765432000198");
    assert.equal(JSON.stringify(ok).includes("segredo"), false, "a senha nunca volta da API");
  });

  it("o certificado de um cliente não vale para outro", async () => {
    const { perfil, salvarPerfil, enviarCertificado } = montar();
    await salvarPerfil(7);
    await enviarCertificado(7, "padaria.pfx", "segredo");
    await salvarPerfil(8);
    assert.equal((await perfil(8)).certificado, null);
    assert.equal((await perfil(8)).pronta, false);
  });

  it("portal de Salvador: pede usuário e senha, recusa senha errada, lê as atividades e mostra o aviso na prontidão", async () => {
    const { perfil, salvarPerfil, salvarPortal } = montar();
    await salvarPerfil(7, { municipioIbge: SALVADOR, canal: "MUNICIPAL_SALVADOR" });
    assert.equal(situacaoDe(await perfil(7), "CREDENCIAL"), "PENDENTE");

    const vazio = await recusa(salvarPortal(7, " ", ""));
    assert.equal(vazio.status, 400);
    assert.deepEqual(Object.keys(vazio.campos).sort(), ["senha", "usuario"]);
    assert.equal((await recusa(salvarPortal(7, "padaria", "errada"))).status, 422);

    const ok = await salvarPortal(7, "padaria", "segredo-do-portal");
    assert.equal(ok.portal?.usuario, "padaria");
    assert.equal(ok.atividadesMunicipais.length, 3); // lidas do portal ao salvar o acesso
    assert.equal(ok.pronta, true);
    assert.equal(JSON.stringify(ok).includes("segredo-do-portal"), false, "a senha nunca volta da API");
    const item = ok.prontidao.find((i) => i.id === "CREDENCIAL")!;
    assert.equal(item.situacao, "ATENCAO");
    assert.match(item.detalhe, /sem certificado/);
  });

  it("trocar o canal padrão não apaga a outra credencial, e remover limpa só a escolhida", async () => {
    const { servidor, perfil, salvarPerfil, enviarCertificado, salvarPortal } = montar();
    await salvarPerfil(7);
    await enviarCertificado(7, "padaria.pfx", "segredo");
    await salvarPerfil(7, { municipioIbge: SALVADOR, canal: "MUNICIPAL_SALVADOR" });
    await salvarPortal(7, "padaria", "segredo-do-portal");

    const ambos = await perfil(7);
    assert.ok(ambos.certificado && ambos.portal);

    await servidor.chamar("/perfis-fiscais/7/portal", { method: "DELETE" });
    const semPortal = await perfil(7);
    assert.equal(semPortal.portal, null);
    assert.deepEqual(semPortal.atividadesMunicipais, []);
    assert.ok(semPortal.certificado);
    assert.equal(semPortal.pronta, false); // o canal padrão ainda é o municipal

    await salvarPerfil(7, { canal: "NACIONAL" }); // volta a Curitiba e ao canal nacional
    assert.equal((await perfil(7)).pronta, true); // o certificado de antes continua valendo
  });
});

describe("teste de conexão", () => {
  it("testa por etapas e só marca como testado quando tudo passa", async () => {
    const { servidor, perfil, salvarPerfil } = await preparar();
    await salvarPerfil(7, { municipioIbge: BRASILIA });
    const ruim = await servidor.chamar<ResultadoTesteConexao>("/perfis-fiscais/7/testar-conexao", { method: "POST" });
    assert.equal(ruim.ok, false);
    assert.equal(ruim.etapas.length, 4);
    assert.deepEqual(ruim.etapas.map((e) => e.ok), [true, false, false, false]);
    assert.equal(situacaoDe(await perfil(7), "CONEXAO"), "ATENCAO");

    await salvarPerfil(7, { municipioIbge: CURITIBA });
    const bom = await servidor.chamar<ResultadoTesteConexao>("/perfis-fiscais/7/testar-conexao", { method: "POST" });
    assert.equal(bom.ok, true);
    assert.equal(situacaoDe(await perfil(7), "CONEXAO"), "OK");
  });

  it("qualquer mudança nos dados ou na credencial pede novo teste", async () => {
    const { servidor, perfil, salvarPerfil, enviarCertificado } = await preparar();
    await servidor.chamar("/perfis-fiscais/7/testar-conexao", { method: "POST" });
    assert.equal(situacaoDe(await perfil(7), "CONEXAO"), "OK");
    await salvarPerfil(7, { inscricaoMunicipal: "999" });
    assert.equal(situacaoDe(await perfil(7), "CONEXAO"), "ATENCAO");

    await servidor.chamar("/perfis-fiscais/7/testar-conexao", { method: "POST" });
    await enviarCertificado(7, "padaria-novo.pfx", "segredo");
    assert.equal(situacaoDe(await perfil(7), "CONEXAO"), "ATENCAO");
  });

  it("pelo canal municipal são três etapas, e só existe para Salvador", async () => {
    const { servidor, salvarPerfil, salvarPortal } = montar();
    await salvarPerfil(7, { municipioIbge: SALVADOR, canal: "MUNICIPAL_SALVADOR" });
    await salvarPortal(7, "padaria", "segredo-do-portal");
    const resultado = await servidor.chamar<ResultadoTesteConexao>("/perfis-fiscais/7/testar-conexao", { method: "POST" });
    assert.equal(resultado.ok, true);
    assert.deepEqual(resultado.etapas.map((e) => e.titulo), ["Acesso ao portal de Salvador", "Município atendido pelo canal municipal", "Login no portal e leitura das atividades"]);
    assert.match(resultado.etapas[2].detalhe, /3 atividades/);

    await salvarPerfil(7); // Curitiba
    assert.equal((await recusa(servidor.chamar("/perfis-fiscais/7/testar-conexao?canal=MUNICIPAL_SALVADOR", { method: "POST" }))).status, 409);
  });

  it("cada canal tem o seu teste de conexão", async () => {
    const { servidor, perfil, salvarPerfil, enviarCertificado, salvarPortal } = montar();
    await salvarPerfil(7, { municipioIbge: SALVADOR });
    await enviarCertificado(7, "padaria.pfx", "segredo");
    await salvarPortal(7, "padaria", "segredo-do-portal");

    const municipal = await servidor.chamar<ResultadoTesteConexao>("/perfis-fiscais/7/testar-conexao?canal=MUNICIPAL_SALVADOR", { method: "POST" });
    assert.equal(municipal.ok, true);
    const canais = (await perfil(7)).canais;
    assert.ok(canais.find((c) => c.canal === "MUNICIPAL_SALVADOR")?.conexaoTestadaEm);
    assert.equal(canais.find((c) => c.canal === "NACIONAL")?.conexaoTestadaEm, null);

    const nacional = await servidor.chamar<ResultadoTesteConexao>("/perfis-fiscais/7/testar-conexao?canal=NACIONAL", { method: "POST" });
    assert.equal(nacional.ok, false); // Salvador emite no sistema da prefeitura: o nacional não passa
  });

  it("não testa um cliente sem dados fiscais", async () => {
    const { servidor } = montar();
    assert.equal((await recusa(servidor.chamar("/perfis-fiscais/7/testar-conexao", { method: "POST" }))).status, 409);
  });
});

describe("tomadores", () => {
  it("cadastra com o documento sem pontuação e lista em ordem alfabética", async () => {
    const { servidor, criarTomador } = montar();
    const aurora = await criarTomador(7);
    assert.equal(aurora.clienteId, 7);
    assert.equal(aurora.documento, "11444777000161");
    await criarTomador(7, { documento: "390.533.447-05", nome: "Ana Pereira", email: "" });

    const lista = await servidor.chamar<Pagina<Tomador>>("/perfis-fiscais/7/tomadores");
    assert.deepEqual(lista.content.map((t) => t.nome), ["Ana Pereira", "Loja Aurora Comércio Ltda"]);
    assert.equal(lista.content[0].email, null);
  });

  it("a lista é de cada cliente e a busca acha por nome (sem acento) ou documento", async () => {
    const { servidor, criarTomador } = montar();
    await criarTomador(7);
    await criarTomador(7, { documento: "39053344705", nome: "João Pereira", email: null });
    await criarTomador(8, { documento: "11444777000161", nome: "Aurora do João", email: null }); // o mesmo CNPJ pode estar na lista de outro cliente

    const nomes = async (clienteId: number, busca: string) =>
      (await servidor.chamar<Pagina<Tomador>>(`/perfis-fiscais/${clienteId}/tomadores?busca=${encodeURIComponent(busca)}`)).content.map((t) => t.nome);
    assert.deepEqual(await nomes(7, ""), ["João Pereira", "Loja Aurora Comércio Ltda"]);
    assert.deepEqual(await nomes(8, ""), ["Aurora do João"]);
    assert.deepEqual(await nomes(7, "joao"), ["João Pereira"]);
    assert.deepEqual(await nomes(7, "390.533"), ["João Pereira"]);
    assert.deepEqual(await nomes(7, "inexistente"), []);
  });

  it("cobra documento válido, nome e e-mail, e recusa o mesmo documento duas vezes no mesmo cliente", async () => {
    const { criarTomador } = montar();
    const invalido = await recusa(criarTomador(7, { documento: "111.444.777-00", nome: " ", email: "sem-arroba" }));
    assert.equal(invalido.status, 400);
    assert.deepEqual(Object.keys(invalido.campos).sort(), ["documento", "email", "nome"]);

    await criarTomador(7);
    const repetido = await recusa(criarTomador(7, { nome: "Outro nome" }));
    assert.equal(repetido.status, 409);
    assert.ok(repetido.campos.documento);
  });

  it("cliente que não existe não tem lista", async () => {
    const { servidor, criarTomador } = montar();
    assert.equal((await recusa(criarTomador(999))).status, 404);
    assert.equal((await recusa(servidor.chamar("/perfis-fiscais/999/tomadores"))).status, 404);
  });

  it("editar o tomador não muda as notas que já saíram, mas vale para as próximas", async () => {
    const { servidor, tomador, criar, emitir } = await preparar();
    const emitida = await emitir((await criar()).id);

    const editado = await servidor.chamar<Tomador>(`/tomadores/${tomador.id}`, { method: "PUT", json: { ...tomadorBase, nome: "Aurora Comércio S.A." } });
    assert.equal(editado.nome, "Aurora Comércio S.A.");
    assert.equal((await servidor.chamar<NotaFiscal>(`/notas-fiscais/${emitida.id}`)).tomadorNome, "Loja Aurora Comércio Ltda");
    assert.equal((await criar()).tomadorNome, "Aurora Comércio S.A.");

    assert.equal((await recusa(servidor.chamar("/tomadores/999", { method: "PUT", json: tomadorBase }))).status, 404);
  });

  it("excluir tira da lista, mas a nota guarda o nome e o documento", async () => {
    const { servidor, tomador, criar, entrada } = await preparar();
    const rascunho = await criar();
    await servidor.chamar(`/tomadores/${tomador.id}`, { method: "DELETE" });

    assert.equal((await servidor.chamar<Pagina<Tomador>>("/perfis-fiscais/7/tomadores")).totalElements, 0);
    const nota = await servidor.chamar<NotaFiscal>(`/notas-fiscais/${rascunho.id}`);
    assert.equal(nota.tomadorId, null);
    assert.equal(nota.tomadorNome, "Loja Aurora Comércio Ltda");
    assert.equal(nota.tomadorDocumento, "11444777000161");

    assert.equal((await recusa(criar())).status, 400); // não dá mais para emitir para ele
    assert.equal((await recusa(servidor.chamar(`/tomadores/${tomador.id}`, { method: "DELETE" }))).status, 404);
    assert.equal(entrada.tomadorId, tomador.id);
  });
});

describe("movimento no portal de Salvador (só leitura)", () => {
  const consultar = (servidor: ServidorDemo, clienteId: number, competencia: string) =>
    servidor.chamar<MovimentoPortal>(`/perfis-fiscais/${clienteId}/movimentos-portal`, { method: "POST", json: { competencia } });

  it("lê notas e guias do mês, guarda e a consulta repetida atualiza a mesma linha", async () => {
    const { servidor, salvarPerfil, salvarPortal } = await preparar();
    await salvarPerfil(7, { municipioIbge: SALVADOR, canal: "MUNICIPAL_SALVADOR" });
    await salvarPortal(7, "98765432000198", "senha-do-portal");

    const setembro = await consultar(servidor, 7, "2026-09");
    assert.equal(setembro.competencia, "2026-09");
    assert.ok(setembro.notasEmitidas >= 1 && setembro.valorEmitido > 0);
    assert.equal(setembro.guias.length, 1);
    assert.equal(setembro.guias[0].emitida, true, "mês fechado: o portal já emitiu a guia");
    assert.match(setembro.guias[0].numero ?? "", /^2026\/\d{6}$/);
    assert.equal(setembro.guias[0].vencimento, "2026-10-08");
    assert.equal(setembro.guias[0].valor, Math.round(setembro.valorEmitido * 5) / 100);

    const julho = await consultar(servidor, 7, "2026-07");
    assert.equal(julho.guias[0].situacao, "QUITADA", "um mês antigo já foi pago pelo cliente");
    assert.equal(julho.guias[0].quitadaEm, "2026-08-05");
    assert.equal(setembro.guias[0].situacao, "PENDENTE");

    const outubro = await consultar(servidor, 7, "2026-10");
    assert.equal(outubro.guias[0].emitida, false, "mês corrente: a guia ainda está a emitir no portal e o sistema não a emite");
    assert.equal(outubro.guias[0].numero, null);

    await consultar(servidor, 7, "2026-09");
    const historico = await servidor.chamar<MovimentoPortal[]>("/perfis-fiscais/7/movimentos-portal");
    assert.deepEqual(historico.map((m) => m.competencia), ["2026-10", "2026-09", "2026-07"]);
    assert.equal(historico[1].id, setembro.id, "a mesma linha foi atualizada");
  });

  it("recusa como o backend: mês inválido ou futuro, sem dados fiscais, fora de Salvador, sem acesso ao portal", async () => {
    const { servidor, salvarPerfil, salvarPortal } = await preparar();
    assert.equal((await recusa(consultar(servidor, 8, "2026-10"))).message, "Salve primeiro os dados fiscais deste cliente.");

    // o cliente 7 já sai de preparar() com dados fiscais em Curitiba
    assert.equal((await recusa(consultar(servidor, 7, "2026-10"))).message, "A consulta ao portal de Salvador só vale para clientes de Salvador.");

    await salvarPerfil(7, { municipioIbge: SALVADOR });
    assert.match((await recusa(consultar(servidor, 7, "2026-10"))).message, /não tem o acesso ao portal/);

    await salvarPortal(7, "98765432000198", "senha-do-portal");
    const futuro = await recusa(consultar(servidor, 7, "2026-11"));
    assert.equal(futuro.status, 400);
    assert.match(futuro.campos.competencia, /ainda não começou/);
    assert.equal((await recusa(consultar(servidor, 7, "2026-13"))).campos.competencia, "Use o formato AAAA-MM");
    assert.equal((await recusa(consultar(servidor, 999, "2026-10"))).status, 404);
  });

  it("o histórico é por cliente", async () => {
    const { servidor, salvarPerfil, salvarPortal } = await preparar();
    await salvarPerfil(7, { municipioIbge: SALVADOR });
    await salvarPortal(7, "98765432000198", "senha-do-portal");
    await consultar(servidor, 7, "2026-09");
    assert.deepEqual(await servidor.chamar<MovimentoPortal[]>("/perfis-fiscais/8/movimentos-portal"), []);
  });
});

describe("financeiro e consulta em lote", () => {
  async function comPortal(clientes: number[] = [7]) {
    const base = await preparar({ atrasoMs: 1000 });
    for (const id of clientes) {
      await base.salvarPerfil(id, { municipioIbge: SALVADOR, canal: "MUNICIPAL_SALVADOR" });
      await base.salvarPortal(id, id === 8 ? "senha-trocada" : "98765432000198", "senha-do-portal");
    }
    return base;
  }
  const financeiro = (servidor: ServidorDemo, mes = "2026-09") => servidor.chamar<Financeiro>(`/financeiro?mes=${mes}`);
  const lote = (servidor: ServidorDemo) => servidor.chamar<LoteConsulta | undefined>("/movimentos-portal/lote");

  it("junta as guias de verdade com o que a simulação leu do portal", async () => {
    const { servidor } = await comPortal([7, 8]);
    const antes = await financeiro(servidor);
    assert.equal(antes.emitido.valor, 0);
    assert.equal(antes.emitido.clientesComAcesso, 2);
    assert.equal(antes.emitido.clientesConsultados, 0);

    await servidor.chamar(`/perfis-fiscais/7/movimentos-portal`, { method: "POST", json: { competencia: "2026-09" } });
    const depois = await financeiro(servidor);
    assert.ok(depois.emitido.valor > 0 && depois.emitido.notas > 0);
    assert.equal(depois.emitido.clientesConsultados, 1);
    assert.equal(depois.guias.emAberto, 100, "o total das guias vem do backend");
    const padaria = depois.clientes.find((c) => c.clienteId === 7);
    assert.equal(padaria?.consultado, true);
    assert.equal(padaria?.nome, "Padaria Pão Quente Ltda");
    assert.equal(depois.clientes[0].clienteId, 8, "quem tem guia vencida vem primeiro");
    assert.equal(depois.serie.find((m) => m.mes === "2026-09")?.emitido, depois.emitido.valor);
    assert.equal(depois.serie.find((m) => m.mes === "2026-08")?.emitido, 0);
  });

  it("o lote consulta os clientes aos poucos, um passo por cliente, e termina sozinho", async () => {
    const { servidor, avancar } = await comPortal([7, 8]);
    assert.equal(await lote(servidor), undefined, "antes de qualquer lote não há nada");

    const iniciado = await servidor.chamar<LoteConsulta>("/movimentos-portal/lote", { method: "POST", json: { competencia: "2026-09" } });
    assert.equal(iniciado.estado, "EM_ANDAMENTO");
    assert.equal(iniciado.total, 2);
    assert.deepEqual(iniciado.itens.map((i) => i.situacao), ["CONSULTANDO", "AGUARDANDO"]);

    avancar(2000); // um passo (2 x o atraso de 1 s)
    const meio = (await lote(servidor))!;
    assert.deepEqual(meio.itens.map((i) => i.situacao), ["OK", "CONSULTANDO"]);
    assert.equal(meio.concluidos, 1);

    avancar(2000);
    const fim = (await lote(servidor))!;
    assert.equal(fim.estado, "CONCLUIDO");
    assert.deepEqual(fim.itens.map((i) => i.situacao), ["OK", "ERRO"], "o cliente com a senha trocada falha sem derrubar os outros");
    assert.match(fim.itens[1].mensagem ?? "", /recusou/);
    assert.equal(fim.comErro, 1);
    assert.equal((await servidor.chamar<MovimentoPortal[]>("/perfis-fiscais/7/movimentos-portal")).length, 1);

    // "Só os que faltam": o que já foi lido é pulado.
    const segundo = await servidor.chamar<LoteConsulta>("/movimentos-portal/lote", { method: "POST", json: { competencia: "2026-09" } });
    assert.deepEqual(segundo.itens.map((i) => i.situacao), ["JA_CONSULTADO", "CONSULTANDO"]);
  });

  it("um lote por vez, cancelar deixa o resto como não tentado, e as mesmas recusas do backend", async () => {
    const { servidor } = await comPortal([7, 8]);
    await servidor.chamar("/movimentos-portal/lote", { method: "POST", json: { competencia: "2026-09" } });
    assert.match((await recusa(servidor.chamar("/movimentos-portal/lote", { method: "POST", json: { competencia: "2026-09" } }))).message, /em andamento/);

    const cancelado = await servidor.chamar<LoteConsulta>("/movimentos-portal/lote/cancelar", { method: "POST" });
    assert.equal(cancelado.estado, "CANCELADO");
    assert.deepEqual(cancelado.itens.map((i) => i.situacao), ["NAO_TENTADO", "NAO_TENTADO"]);
    assert.equal((await recusa(servidor.chamar("/movimentos-portal/lote/cancelar", { method: "POST" }))).status, 409);

    assert.equal((await recusa(servidor.chamar("/movimentos-portal/lote", { method: "POST", json: { competencia: "2026-13" } }))).status, 400);
    assert.match((await recusa(servidor.chamar("/movimentos-portal/lote", { method: "POST", json: { competencia: "2026-11" } }))).campos.competencia, /ainda não começou/);
  });
});

describe("estado compartilhado", () => {
  it("duas abas (dois servidores sobre o mesmo armazenamento) enxergam a mesma coisa", async () => {
    const armazenamento = armazenamentoEmMemoria();
    const a = await preparar({ armazenamento });
    const b = montar({ armazenamento });
    const nota = await a.criar();
    assert.equal((await b.detalhe(nota.id)).tomadorNome, "Loja Aurora Comércio Ltda");
    assert.equal((await b.servidor.chamar<Pagina<NotaFiscalResumo>>("/notas-fiscais")).totalElements, 9);
    assert.equal((await b.perfil(7)).pronta, true);
  });

  it("restaurar volta ao estado de partida: notas de exemplo, sem dados fiscais nem tomadores", async () => {
    const { servidor, criar, perfil } = await preparar();
    await criar();
    await criar();
    await servidor.chamar("/demo/reiniciar", { method: "POST" });
    assert.equal((await servidor.chamar<Pagina<NotaFiscalResumo>>("/notas-fiscais")).totalElements, 8);
    assert.equal((await perfil(7)).configurado, false);
    assert.equal((await servidor.chamar<Pagina<Tomador>>("/perfis-fiscais/7/tomadores")).totalElements, 0);
  });

  it("rota desconhecida é 404", async () => {
    const { servidor } = montar();
    assert.equal((await recusa(servidor.chamar("/notas-fiscais/abc"))).status, 404);
    assert.equal((await recusa(servidor.chamar("/nada"))).status, 404);
  });
});
