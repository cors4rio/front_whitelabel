import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MUNICIPIOS } from "./dados/municipios.ts";
import { buscarMunicipios, leituraDaSituacao, municipioPorIbge, MUNICIPIOS_REFERENCIA, rotuloDoMunicipio } from "./municipios.ts";

/** Os dois primeiros dígitos do código IBGE do município são o código da UF. */
const CODIGO_DA_UF: Record<string, string> = {
  AC: "12", AL: "27", AP: "16", AM: "13", BA: "29", CE: "23", DF: "53", ES: "32", GO: "52", MA: "21", MT: "51", MS: "50", MG: "31", PA: "15",
  PB: "25", PR: "41", PE: "26", PI: "22", RJ: "33", RN: "24", RS: "43", RO: "11", RR: "14", SC: "42", SP: "35", SE: "28", TO: "17",
};

describe("municípios (dado gerado)", () => {
  it("cobre os 5.571 municípios, com código IBGE de 7 dígitos e sem repetição", () => {
    assert.equal(MUNICIPIOS.length, 5571);
    assert.equal(new Set(MUNICIPIOS.map(([ibge]) => ibge)).size, MUNICIPIOS.length);
    assert.ok(MUNICIPIOS.every(([ibge]) => /^\d{7}$/.test(ibge)));
  });

  it("a UF de cada município confere com o prefixo do código IBGE (pega erro na junção das fontes)", () => {
    const divergentes = MUNICIPIOS.filter(([ibge, , uf]) => CODIGO_DA_UF[uf] !== ibge.slice(0, 2)).map(([ibge, nome, uf]) => `${ibge} ${nome}/${uf}`);
    assert.deepEqual(divergentes, []);
  });

  it("guarda a data da planilha de adesões de que a situação foi tirada", () => {
    assert.match(MUNICIPIOS_REFERENCIA, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("a situação é sempre um dos quatro valores conhecidos", () => {
    assert.ok(MUNICIPIOS.every(([, , , situacao]) => [0, 1, 2, 3].includes(situacao)));
  });
});

describe("municipioPorIbge", () => {
  it("devolve o município, ou null", () => {
    const curitiba = municipioPorIbge("4106902");
    assert.equal(curitiba?.nome, "Curitiba");
    assert.equal(curitiba?.uf, "PR");
    assert.equal(rotuloDoMunicipio(curitiba!), "Curitiba/PR");
    assert.equal(municipioPorIbge("0000000"), null);
  });
});

describe("buscarMunicipios", () => {
  it("acha por nome sem ligar para acento nem caixa, começo do nome primeiro", () => {
    assert.equal(buscarMunicipios("curitiba")[0].ibge, "4106902");
    assert.equal(buscarMunicipios("GOIANIA")[0].nome, "Goiânia");
    assert.equal(buscarMunicipios("sao paulo")[0].ibge, "3550308");
  });

  it("um sufixo de UF restringe a busca (com espaço ou barra)", () => {
    const todas = buscarMunicipios("santa cruz", 50);
    assert.ok(new Set(todas.map((m) => m.uf)).size > 1, "há Santa Cruz em vários estados");
    const so = buscarMunicipios("santa cruz/rn", 50);
    assert.ok(so.length > 0 && so.every((m) => m.uf === "RN"));
    assert.ok(buscarMunicipios("curitiba pr").every((m) => m.uf === "PR"));
  });

  it("sem texto não lista nada, e respeita o limite", () => {
    assert.deepEqual(buscarMunicipios(""), []);
    assert.deepEqual(buscarMunicipios("  / "), []);
    assert.equal(buscarMunicipios("sao", 5).length, 5);
  });
});

describe("leituraDaSituacao", () => {
  it("só o Emissor Nacional liberado é verde; as demais explicam o que fazer", () => {
    assert.equal(leituraDaSituacao({ nome: "X", situacao: 2 }).tom, "ok");
    assert.equal(leituraDaSituacao({ nome: "X", situacao: 1 }).tom, "problema");
    assert.equal(leituraDaSituacao({ nome: "X", situacao: 0 }).tom, "problema");
    assert.equal(leituraDaSituacao({ nome: "X", situacao: 3 }).tom, "atencao");
    assert.match(leituraDaSituacao({ nome: "Atlântida", situacao: 1 }).detalhe, /Atlântida.*prefeitura/);
  });
});
