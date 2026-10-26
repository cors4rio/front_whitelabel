// Roda com: npm test (node:test; o Node estripa os tipos TypeScript sozinho).
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { documentoValido, formatarDocumento, normalizarDocumento, tipoPessoaDoDocumento } from "./documento.ts";

// Os mesmos casos de DocumentoTest.java: a cópia do front não pode divergir do backend.
describe("documentoValido", () => {
  it("aceita CPF válido com ou sem pontuação", () => {
    for (const cpf of ["529.982.247-25", "52998224725", " 529 982 247 25 "]) assert.equal(documentoValido(cpf), true, cpf);
  });

  it("rejeita CPF inválido", () => {
    for (const cpf of ["529.982.247-26", "111.111.111-11", "12345678900", "5299822472", "abc.def.ghi-jk"])
      assert.equal(documentoValido(cpf), false, cpf);
  });

  it("aceita CNPJ numérico válido e rejeita inválido", () => {
    assert.equal(documentoValido("11.222.333/0001-81"), true);
    for (const cnpj of ["11.222.333/0001-82", "00.000.000/0000-00", "1122233300018"])
      assert.equal(documentoValido(cnpj), false, cnpj);
  });

  it("aceita CNPJ alfanumérico (exemplo oficial do Serpro) e rejeita inválidos", () => {
    for (const cnpj of ["12.ABC.345/01DE-35", "12abc34501de35"]) assert.equal(documentoValido(cnpj), true, cnpj);
    for (const cnpj of ["12.ABC.345/01DE-36", "12.ABC.345/01DE-3A", "12.ABC.345/01DE-AA"])
      assert.equal(documentoValido(cnpj), false, cnpj);
  });
});

describe("normalizarDocumento / tipoPessoaDoDocumento", () => {
  it("remove pontuação e põe em maiúsculas", () => {
    assert.equal(normalizarDocumento("12.abc.345/01de-35"), "12ABC34501DE35");
  });

  it("deduz PF/PJ pelo tamanho", () => {
    assert.equal(tipoPessoaDoDocumento("529.982.247-25"), "PF");
    assert.equal(tipoPessoaDoDocumento("11222333000181"), "PJ");
    assert.equal(tipoPessoaDoDocumento("123"), null);
  });
});

describe("formatarDocumento", () => {
  it("formata CPF completo e parcial", () => {
    assert.equal(formatarDocumento("52998224725"), "529.982.247-25");
    assert.equal(formatarDocumento("5299"), "529.9");
    assert.equal(formatarDocumento("529982"), "529.982");
  });

  it("formata CNPJ numérico e alfanumérico", () => {
    assert.equal(formatarDocumento("11222333000181"), "11.222.333/0001-81");
    assert.equal(formatarDocumento("12ABC34501DE35"), "12.ABC.345/01DE-35");
  });

  it("aceita vazio/nulo", () => {
    assert.equal(formatarDocumento(""), "");
    assert.equal(formatarDocumento(null), "");
  });
});
