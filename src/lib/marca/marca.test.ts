import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";

import { contraste, problemasDaMarca } from "./contraste.ts";
import { temaCss } from "./tema.ts";
import type { Marca } from "./tipos.ts";

const PASTA_MARCAS = new URL("../../brands/", import.meta.url);
const IDS = readdirSync(PASTA_MARCAS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

async function carregar(id: string): Promise<Marca> {
  return (await import(new URL(`${id}/marca.ts`, PASTA_MARCAS).href)).marca;
}

test("contraste: valores de referência do WCAG", () => {
  assert.equal(contraste("#000000", "#ffffff").toFixed(1), "21.0");
  assert.equal(contraste("#777777", "#777777").toFixed(1), "1.0");
  assert.equal(contraste("#ffffff", "#000000"), contraste("#000000", "#ffffff"));
});

test("há pelo menos a marca padrão e a de exemplo", () => {
  assert.ok(IDS.includes("claudaccount"));
  assert.ok(IDS.includes("exemplo"));
});

for (const id of IDS) {
  test(`marca "${id}": id, fonts.ts e contraste AA em claro e escuro`, async () => {
    const marca = await carregar(id);
    assert.equal(marca.id, id, "o id precisa ser o nome da pasta");
    assert.ok(marca.nome.trim().length > 0);
    assert.ok(readdirSync(new URL(`${id}/`, PASTA_MARCAS)).includes("fonts.ts"), "falta fonts.ts na pasta da marca");
    assert.deepEqual(problemasDaMarca(marca), []);
  });
}

test("problemasDaMarca reprova paleta sem contraste e cor fora do formato", async () => {
  const base = await carregar("claudaccount");
  const ruim: Marca = { ...base, cores: { ...base.cores, claro: { ...base.cores.claro, onAccent: "#ffffff", fg: "preto" } } };
  const problemas = problemasDaMarca(ruim);
  assert.ok(problemas.some((p) => p.includes("claro.fg")));
  const semFg: Marca = { ...base, cores: { ...base.cores, claro: { ...base.cores.claro, onAccent: "#ffffff" } } };
  assert.ok(problemasDaMarca(semFg).some((p) => p.includes("onAccent sobre accent")));
});

test("temaCss gera o tema claro em :root e o escuro só com data-theme", async () => {
  const marca = await carregar("claudaccount");
  const css = temaCss(marca);
  assert.match(css, /^:root\{--bg:#faf6f0;/);
  assert.match(css, /--radius-ui:10px;color-scheme:light;\}/);
  assert.match(css, /:root\[data-theme="dark"\]\{--bg:#1a1412;/);
  assert.ok(!css.includes("prefers-color-scheme"), "o sistema ignora a preferência do sistema operacional");
});
