import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classeDaData, complementoVencimento, situacaoDaGuia, tamanhoLegivel, textoVencimento } from "./guias.ts";

type G = Parameters<typeof textoVencimento>[0] & Parameters<typeof complementoVencimento>[0] & Parameters<typeof situacaoDaGuia>[0];

const pendente = (dias: number): G => ({
  status: "PENDENTE",
  diasParaVencimento: dias,
  vencida: dias < 0,
  vencendo: dias >= 0 && dias <= 7,
  dataPagamento: null,
});

describe("situacaoDaGuia", () => {
  it("deriva 'vencida' da pendente com vencimento passado", () => {
    assert.equal(situacaoDaGuia(pendente(-3)), "VENCIDA");
    assert.equal(situacaoDaGuia(pendente(0)), "PENDENTE");
    assert.equal(situacaoDaGuia({ status: "PAGA", vencida: false }), "PAGA");
    assert.equal(situacaoDaGuia({ status: "CANCELADA", vencida: false }), "CANCELADA");
  });
});

describe("textoVencimento", () => {
  it("fala em linguagem de gente, no singular e no plural certos", () => {
    assert.equal(textoVencimento(pendente(-5)), "Venceu há 5 dias");
    assert.equal(textoVencimento(pendente(-2)), "Venceu há 2 dias");
    assert.equal(textoVencimento(pendente(-1)), "Venceu ontem");
    assert.equal(textoVencimento(pendente(0)), "Vence hoje");
    assert.equal(textoVencimento(pendente(1)), "Vence amanhã");
    assert.equal(textoVencimento(pendente(3)), "Vence em 3 dias");
    assert.equal(textoVencimento(pendente(40)), "Vence em 40 dias");
  });

  it("guia paga e cancelada dizem o que aconteceu, sem urgência", () => {
    assert.equal(textoVencimento({ status: "PAGA", diasParaVencimento: -20, dataPagamento: "2026-10-15" }), "Paga em 15/10/2026");
    assert.equal(textoVencimento({ status: "CANCELADA", diasParaVencimento: 5, dataPagamento: null }), "Guia cancelada");
  });
});

describe("complementoVencimento", () => {
  it("só aparece quando há urgência, para acompanhar a cor da data", () => {
    assert.equal(complementoVencimento(pendente(-3)), "há 3 dias");
    assert.equal(complementoVencimento(pendente(-1)), "ontem");
    assert.equal(complementoVencimento(pendente(0)), "hoje");
    assert.equal(complementoVencimento(pendente(1)), "amanhã");
    assert.equal(complementoVencimento(pendente(7)), "em 7 dias");
    assert.equal(complementoVencimento(pendente(8)), "");
    assert.equal(complementoVencimento({ status: "PAGA", vencida: false, vencendo: false, diasParaVencimento: -9 }), "");
  });
});

describe("classeDaData", () => {
  it("crimson se vencida, âmbar se vencendo, neutra nos demais", () => {
    assert.equal(classeDaData({ vencida: true, vencendo: false }), "text-crimson");
    assert.equal(classeDaData({ vencida: false, vencendo: true }), "text-amber-ink");
    assert.equal(classeDaData({ vencida: false, vencendo: false }), "");
  });
});

describe("tamanhoLegivel", () => {
  it("escolhe a unidade", () => {
    assert.equal(tamanhoLegivel(500), "500 B");
    assert.equal(tamanhoLegivel(340 * 1024), "340 KB");
    assert.equal(tamanhoLegivel(1.25 * 1024 * 1024), "1,3 MB");
  });
});
