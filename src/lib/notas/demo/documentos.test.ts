import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { gerarPdfMinimo } from "./documentos.ts";

const texto = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

describe("gerarPdfMinimo", () => {
  it("produz um PDF com a estrutura certa: cabeçalho, objetos nos deslocamentos da tabela xref e fim de arquivo", () => {
    const pdf = gerarPdfMinimo(["Primeira linha", "Segunda (com parênteses) e \\ barra"]);
    const t = texto(pdf);
    assert.ok(t.startsWith("%PDF-1.4\n"));
    assert.ok(t.trimEnd().endsWith("%%EOF"));

    const inicioXref = Number(/startxref\n(\d+)\n/.exec(t)![1]);
    assert.equal(t.slice(inicioXref, inicioXref + 4), "xref");

    const entradas = [...t.slice(inicioXref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    assert.equal(entradas.length, 5);
    entradas.forEach((deslocamento, i) => assert.equal(t.slice(deslocamento, deslocamento + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`));
  });

  it("declara o tamanho do fluxo de conteúdo de acordo com os bytes reais", () => {
    const t = texto(gerarPdfMinimo(["Olá, ação e coração"]));
    const declarado = Number(/\/Length (\d+)/.exec(t)![1]);
    const fluxo = /stream\n([\s\S]*?)\nendstream/.exec(t)![1];
    assert.equal(fluxo.length, declarado);
  });

  it("escapa parênteses e barras do texto e mantém os acentos em Latin-1", () => {
    const t = texto(gerarPdfMinimo(["a (b) \\ c", "ç é"]));
    assert.match(t, /\(a \\\(b\\\) \\\\ c\) Tj/);
    assert.ok(t.includes("(ç é) Tj"));
  });

  it("troca por '?' o que o Latin-1 não representa", () => {
    assert.match(texto(gerarPdfMinimo(["preço € 10"])), /\(preço \? 10\) Tj/);
  });
});
