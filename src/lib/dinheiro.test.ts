import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatarDinheiroCampo, parseDinheiro } from "./dinheiro.ts";

describe("parseDinheiro", () => {
  it("lê o formato brasileiro", () => {
    assert.equal(parseDinheiro("199,90"), 199.9);
    assert.equal(parseDinheiro("1.234,56"), 1234.56);
    assert.equal(parseDinheiro("12.345.678,9"), 12345678.9);
    assert.equal(parseDinheiro("R$ 1.234,56"), 1234.56);
    assert.equal(parseDinheiro("0,5"), 0.5);
    assert.equal(parseDinheiro("350"), 350);
    assert.equal(parseDinheiro("  45,00  "), 45);
  });

  it("lê o formato com ponto decimal colado de planilha, sem multiplicar por mil", () => {
    // O bug que isto evita: remover todos os pontos transformaria 199.90 em 19990.
    assert.equal(parseDinheiro("199.90"), 199.9);
    assert.equal(parseDinheiro("1245.5"), 1245.5);
    assert.equal(parseDinheiro("0.5"), 0.5);
  });

  it("entende ponto como separador de milhar só em grupos de 3 dígitos", () => {
    assert.equal(parseDinheiro("1.234"), 1234);
    assert.equal(parseDinheiro("1.234.567"), 1234567);
  });

  it("recusa o que não é um valor em reais", () => {
    for (const ruim of ["", "abc", "-5", "1,234", "12,3,4", "1.2.3", "1.23.456", "1.234,5,6", ",50", "10,5x", "1e3", "12.34.567,00"]) {
      assert.equal(parseDinheiro(ruim), null, `"${ruim}" deveria ser inválido`);
    }
  });
});

describe("formatarDinheiroCampo", () => {
  it("usa vírgula e duas casas, sem separador de milhar", () => {
    assert.equal(formatarDinheiroCampo(1245.9), "1245,90");
    assert.equal(formatarDinheiroCampo(350), "350,00");
  });

  it("vai e volta sem perder o valor", () => {
    for (const valor of [0.01, 199.9, 1245.9, 99999999.99]) assert.equal(parseDinheiro(formatarDinheiroCampo(valor)), valor);
  });
});
