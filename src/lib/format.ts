const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const BRL_INTEIRO = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const NUMERO = new Intl.NumberFormat("pt-BR");

export const moeda = (valor: number) => BRL.format(valor);
/** Sem centavos, para números de destaque (KPI). */
export const moedaInteira = (valor: number) => BRL_INTEIRO.format(valor);
export const numero = (valor: number) => NUMERO.format(valor);

/** "2024-03-15" -> "15/03/2024" (sem passar por Date: evita o deslocamento de fuso). */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/** (11) 91234-5678, (11) 1234-5678; mantém o que não reconhece. */
export function formatarTelefone(valor: string | null | undefined): string {
  const d = (valor ?? "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return valor ?? "";
}

const FUSO_ESCRITORIO = "America/Sao_Paulo";

/** "2026-10-15T17:32:00Z" -> "15/10/2026 às 14:32", no fuso do escritório (não no do aparelho). */
export function dataHoraBR(instante: string | null | undefined): string {
  if (!instante) return "";
  const d = new Date(instante);
  const data = d.toLocaleDateString("pt-BR", { timeZone: FUSO_ESCRITORIO });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: FUSO_ESCRITORIO, hour: "2-digit", minute: "2-digit" });
  return `${data} às ${hora}`;
}

/** "2026-10-15T17:32:00Z" -> "15/10/2026", no fuso do escritório (um instante perto da meia-noite UTC cai no dia anterior). */
export function dataDoInstanteBR(instante: string | null | undefined): string {
  if (!instante) return "";
  return new Date(instante).toLocaleDateString("pt-BR", { timeZone: FUSO_ESCRITORIO });
}

/**
 * A data de hoje (AAAA-MM-DD) no fuso do escritório, a mesma que o servidor usa para decidir o que está vencido.
 * Usada como padrão e limite de campos de data; o servidor continua sendo quem valida.
 */
export function hojeNoEscritorio(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_ESCRITORIO }).format(new Date());
}
