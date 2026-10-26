import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatarFator, rotuloDaBase, rotuloDoAnexo } from "./fator-r.ts";

describe("Fator R: textos", () => {
  it("formata a razão como percentual brasileiro e o sem base como traço", () => {
    assert.equal(formatarFator(0.285), "28,50%");
    assert.equal(formatarFator(0.28), "28,00%");
    assert.equal(formatarFator(0), "0,00%");
    assert.equal(formatarFator(1.2345), "123,45%");
    assert.equal(formatarFator(null), "—");
  });

  it("diz quantos meses entraram na conta", () => {
    assert.equal(rotuloDaBase({ mesesConsiderados: 12, completo: true }), "12 meses");
    assert.equal(rotuloDaBase({ mesesConsiderados: 8, completo: false }), "8 de 12 meses");
    assert.equal(rotuloDaBase({ mesesConsiderados: 1, completo: false }), "1 de 12 meses");
    assert.equal(rotuloDaBase({ mesesConsiderados: 0, completo: false }), "nenhum mês");
  });

  it("nomeia o anexo", () => {
    assert.equal(rotuloDoAnexo("III"), "Anexo III");
    assert.equal(rotuloDoAnexo("V"), "Anexo V");
    assert.equal(rotuloDoAnexo(null), "Sem base");
  });
});
