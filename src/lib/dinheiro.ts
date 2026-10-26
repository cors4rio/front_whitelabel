/**
 * Lê um valor em reais digitado à brasileira ("1.234,56", "199,90", "R$ 1.234,56") ou colado de uma planilha
 * ("199.90"). Devolve null se não for um valor válido (letras, negativo, mais de 2 casas decimais...).
 *
 * Regras de separador:
 * - com vírgula: a vírgula é o decimal e os pontos antes dela são milhares ("1.234,56" = 1234,56);
 * - sem vírgula, com ponto: um único ponto seguido de 1 ou 2 dígitos é decimal ("199.90" = 199,9);
 *   pontos seguidos de grupos de exatamente 3 dígitos são milhares ("1.234" = 1234; "1.234.567" = 1234567).
 */
export function parseDinheiro(texto: string): number | null {
  const t = texto.replace(/^\s*R\$\s*/i, "").replace(/\s/g, "");
  if (!/^\d[\d.,]*$/.test(t)) return null;

  let inteira: string;
  let fracao = "";
  const virgulas = t.split(",");
  if (virgulas.length > 2) return null;

  if (virgulas.length === 2) {
    inteira = virgulas[0].replace(/\./g, "");
    fracao = virgulas[1];
    if (!agrupamentoValido(virgulas[0])) return null;
  } else {
    const pontos = t.split(".");
    if (pontos.length === 1) {
      inteira = t;
    } else if (pontos.length === 2 && pontos[1].length >= 1 && pontos[1].length <= 2) {
      inteira = pontos[0];
      fracao = pontos[1];
    } else if (pontos.slice(1).every((grupo) => grupo.length === 3)) {
      inteira = pontos.join("");
    } else {
      return null;
    }
  }

  if (!/^\d+$/.test(inteira) || !/^\d{0,2}$/.test(fracao)) return null;
  return Number(`${inteira}.${fracao || "0"}`);
}

/** Pontos da parte inteira só podem ser milhares: "1.234" sim, "1.23" e "12.34.567" não. */
function agrupamentoValido(inteira: string): boolean {
  const grupos = inteira.split(".");
  return grupos.length === 1 || (grupos[0].length >= 1 && grupos[0].length <= 3 && grupos.slice(1).every((g) => g.length === 3));
}

/** Valor para preencher um campo de edição: "1245,90" (sem milhar, para não confundir a releitura). */
export function formatarDinheiroCampo(valor: number): string {
  return valor.toFixed(2).replace(".", ",");
}
