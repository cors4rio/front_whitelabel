import { MUNICIPIOS, MUNICIPIOS_REFERENCIA, type SituacaoNoSistemaNacional } from "./dados/municipios.ts";
import type { Tom } from "./regras.ts";

export { MUNICIPIOS_REFERENCIA };
export type { SituacaoNoSistemaNacional };

export interface Municipio {
  ibge: string;
  nome: string;
  uf: string;
  situacao: SituacaoNoSistemaNacional;
}

const semAcento = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

const todos: Municipio[] = MUNICIPIOS.map(([ibge, nome, uf, situacao]) => ({ ibge, nome, uf, situacao }));
const indexados = todos.map((m) => ({ municipio: m, nome: semAcento(m.nome), uf: m.uf.toLowerCase() }));
const porIbge = new Map(todos.map((m) => [m.ibge, m]));

export const municipioPorIbge = (ibge: string): Municipio | null => porIbge.get(ibge) ?? null;

/** Rótulo de um município em listas e campos: "Curitiba/PR". */
export const rotuloDoMunicipio = (m: Pick<Municipio, "nome" | "uf">) => `${m.nome}/${m.uf}`;

/**
 * Busca pelo nome, sem ligar para acento ou maiúscula. Um sufixo de UF restringe ("curitiba pr", "Santa Cruz/RN").
 * Nomes que começam pelo texto vêm antes dos que apenas o contêm.
 */
export function buscarMunicipios(termo: string, limite = 8): Municipio[] {
  const partes = semAcento(termo)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (partes.length === 0) return [];
  const ultima = partes[partes.length - 1];
  const filtrarUf = partes.length > 1 && /^[a-z]{2}$/.test(ultima) ? ultima : null;
  const consulta = (filtrarUf ? partes.slice(0, -1) : partes).join(" ");

  const comeco: Municipio[] = [];
  const meio: Municipio[] = [];
  for (const { municipio, nome, uf } of indexados) {
    if (filtrarUf && uf !== filtrarUf) continue;
    if (nome.startsWith(consulta)) comeco.push(municipio);
    else if (nome.includes(consulta)) meio.push(municipio);
    if (comeco.length >= limite) break;
  }
  return [...comeco, ...meio].slice(0, limite);
}

export interface LeituraDaSituacao {
  tom: Tom;
  titulo: string;
  detalhe: string;
}

/** O que a situação do município significa para quem quer emitir pelo sistema (e o que fazer se não der). */
export function leituraDaSituacao(m: Pick<Municipio, "nome" | "situacao">): LeituraDaSituacao {
  switch (m.situacao) {
    case 2:
      return {
        tom: "ok",
        titulo: "Emissor Nacional liberado",
        detalhe: `Os contribuintes de ${m.nome} podem emitir NFS-e pelo sistema nacional, que é o caminho usado aqui.`,
      };
    case 1:
      return {
        tom: "problema",
        titulo: "Emissão pelo sistema da prefeitura",
        detalhe: `${m.nome} participa do sistema nacional, mas os contribuintes emitem no sistema da própria prefeitura. Para emitir por aqui, a prefeitura precisa liberar o Emissor Nacional.`,
      };
    case 0:
      return {
        tom: "problema",
        titulo: "Município sem convênio ativo",
        detalhe: `${m.nome} não tem convênio ativo com o sistema nacional de NFS-e, então não dá para emitir por aqui.`,
      };
    case 3:
      return {
        tom: "atencao",
        titulo: "Sem informação sobre o município",
        detalhe: `A planilha de adesões do governo não traz ${m.nome}. Confirme com a prefeitura se o Emissor Nacional está liberado.`,
      };
  }
}
