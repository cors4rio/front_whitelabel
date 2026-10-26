import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SERVICOS_NACIONAIS } from "./dados/servicos-nacionais.ts";
import { buscarServicos, descricaoDoServico, formatarCodigoServico, servicoPorCodigo, SERVICO_CONTABIL } from "./servicos.ts";

describe("lista nacional de serviços (dado gerado)", () => {
  it("tem códigos de 6 dígitos, únicos, e descrição em todos", () => {
    const codigos = SERVICOS_NACIONAIS.map(([c]) => c);
    assert.ok(codigos.every((c) => /^\d{6}$/.test(c)));
    assert.equal(new Set(codigos).size, codigos.length);
    assert.ok(SERVICOS_NACIONAIS.every(([, d]) => d.trim().length > 0));
    assert.ok(codigos.length > 300);
  });

  it("traz o serviço do escritório contábil", () => {
    assert.equal(SERVICO_CONTABIL, "171901");
    assert.match(descricaoDoServico("171901") ?? "", /^Contabilidade/);
    assert.equal(descricaoDoServico("000000"), null);
    assert.deepEqual(servicoPorCodigo("999999"), null);
  });
});

describe("formatarCodigoServico", () => {
  it("separa item, subitem e desdobro", () => {
    assert.equal(formatarCodigoServico("171901"), "17.19.01");
    assert.equal(formatarCodigoServico("010101"), "01.01.01");
  });
  it("devolve como veio o que não é um código de 6 dígitos", () => {
    assert.equal(formatarCodigoServico(""), "");
    assert.equal(formatarCodigoServico("1719"), "1719");
  });
});

describe("buscarServicos", () => {
  it("sem texto, sugere os serviços de um escritório contábil, contabilidade primeiro", () => {
    const sugestoes = buscarServicos("");
    assert.equal(sugestoes[0].codigo, "171901");
    assert.ok(sugestoes.length >= 3);
  });

  it("acha pelo código, com ou sem pontos, e pelo começo do código", () => {
    assert.equal(buscarServicos("171901")[0].codigo, "171901");
    assert.equal(buscarServicos("17.19.01")[0].codigo, "171901");
    assert.ok(buscarServicos("17.19").some((s) => s.codigo === "171901"));
    assert.ok(buscarServicos("1719").some((s) => s.codigo === "171901"));
  });

  it("acha por palavras da descrição, sem ligar para acento ou caixa", () => {
    assert.equal(buscarServicos("contabilidade")[0].codigo, "171901");
    assert.equal(buscarServicos("CONTABILIDADE tecnicos")[0].codigo, "171901");
    assert.ok(buscarServicos("auditoria").some((s) => s.codigo === "171601"));
  });

  it("respeita o limite e não acha lixo", () => {
    assert.ok(buscarServicos("servicos", 5).length <= 5);
    assert.deepEqual(buscarServicos("xqzwv"), []);
  });
});
