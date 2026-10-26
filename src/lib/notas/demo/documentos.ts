// Arquivos que a simulação entrega no lugar do XML e do DANFSE reais. Servem para exercitar "abrir" e "baixar"
// e deixam claro, no próprio arquivo, que não têm validade fiscal.

import { formatarDocumento } from "../../documento.ts";
import { dataBR, dataHoraBR, moeda } from "../../format.ts";
import type { NotaFiscal } from "../../types.ts";
import { formatarCodigoServico, descricaoDoServico } from "../servicos.ts";
import type { PerfilGuardado } from "./banco.ts";

const AVISO = "DEMONSTRAÇÃO: este arquivo não é uma NFS-e real e não tem validade fiscal.";

const escaparXml = (texto: string) =>
  texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Um XML com o formato geral da NFS-e Nacional (DPS dentro da NFS-e), só com o que a simulação conhece. */
export function gerarXmlDemo(nota: NotaFiscal, perfil: Pick<PerfilGuardado, "municipioIbge" | "opcaoSimples"> | null): string {
  const tpAmb = nota.ambiente === "PRODUCAO" ? 1 : 2;
  const tomador = nota.tomadorDocumento.length === 11 ? "CPF" : "CNPJ";
  const prestador = nota.prestadorDocumento.length === 11 ? "CPF" : "CNPJ";
  const r = nota.retencoes;
  const retido = (valor: number | null, tag: string) => (valor ? `<${tag}>${valor.toFixed(2)}</${tag}>` : "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${AVISO} -->
<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">
  <infNFSe Id="NFS${nota.chaveAcesso ?? ""}">
    <nNFSe>${escaparXml(nota.numero ?? "")}</nNFSe>
    <dhProc>${escaparXml(nota.emitidaEm ?? "")}</dhProc>
    <DPS versao="1.01">
      <infDPS>
        <tpAmb>${tpAmb}</tpAmb>
        <serie>${nota.serie ?? ""}</serie>
        <nDPS>${nota.numeroDps ?? ""}</nDPS>
        <dCompet>${escaparXml(nota.competencia)}</dCompet>
        <tpEmit>1</tpEmit>
        <cLocEmi>${escaparXml(perfil?.municipioIbge ?? "")}</cLocEmi>
        <prest>
          <${prestador}>${escaparXml(nota.prestadorDocumento)}</${prestador}>
          <xNome>${escaparXml(nota.prestadorNome)}</xNome>
          <regTrib><opSimpNac>${perfil?.opcaoSimples === "ME_EPP" ? 3 : perfil?.opcaoSimples === "MEI" ? 2 : 1}</opSimpNac></regTrib>
        </prest>
        <toma>
          <${tomador}>${escaparXml(nota.tomadorDocumento)}</${tomador}>
          <xNome>${escaparXml(nota.tomadorNome)}</xNome>
        </toma>
        <serv>
          <cServ>
            <cTribNac>${escaparXml(nota.codigoServico)}</cTribNac>
            <xDescServ>${escaparXml(nota.descricaoServico)}</xDescServ>
          </cServ>
        </serv>
        <valores>
          <vServPrest><vServ>${nota.valor.toFixed(2)}</vServ></vServPrest>
          <trib>
            <tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>${nota.issRetido ? 2 : 1}</tpRetISSQN></tribMun>
            <tribFed>${retido(r.pis, "vPis")}${retido(r.cofins, "vCofins")}${retido(r.irrf, "vRetIRRF")}${retido(r.csll, "vRetCSLL")}${retido(r.previdencia, "vRetCP")}</tribFed>
          </trib>
        </valores>
      </infDPS>
    </DPS>
  </infNFSe>
</NFSe>
`;
}

/** Linhas de texto do "DANFSE" de demonstração. */
export function linhasDoDanfse(nota: NotaFiscal): string[] {
  return [
    "DANFSE - Documento Auxiliar da NFS-e (DEMONSTRACAO)",
    AVISO,
    "",
    `NFS-e nº ${nota.numero ?? "-"}   |   Emitida em ${nota.emitidaEm ? dataHoraBR(nota.emitidaEm) : "-"}`,
    `Chave de acesso: ${nota.chaveAcesso ?? "-"}`,
    `Ambiente: ${nota.ambiente === "PRODUCAO" ? "Producao" : "Homologacao (sem valor fiscal)"}`,
    "",
    "PRESTADOR",
    `${nota.prestadorNome}  -  ${formatarDocumento(nota.prestadorDocumento)}`,
    "",
    "TOMADOR",
    `${nota.tomadorNome}  -  ${formatarDocumento(nota.tomadorDocumento)}`,
    "",
    "SERVICO",
    `${formatarCodigoServico(nota.codigoServico)} - ${descricaoDoServico(nota.codigoServico) ?? ""}`,
    `Competencia: ${dataBR(nota.competencia)}`,
    ...quebrar(nota.descricaoServico, 90),
    "",
    `Valor do servico: ${moeda(nota.valor)}`,
    `ISS retido pelo tomador: ${nota.issRetido ? "Sim" : "Nao"}`,
    ...(Object.entries(nota.retencoes) as [string, number | null][]).filter(([, v]) => v).map(([k, v]) => `Retencao ${k.toUpperCase()}: ${moeda(v as number)}`),
    nota.valorIss !== null ? `ISS: ${moeda(nota.valorIss)} (${nota.aliquotaIss ?? 0}%)` : "ISS: recolhido no DAS (Simples Nacional)",
  ];
}

function quebrar(texto: string, largura: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/)) {
    if (atual && atual.length + palavra.length + 1 > largura) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = atual ? `${atual} ${palavra}` : palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Texto → bytes Latin-1 (o que a codificação WinAnsi do PDF espera); o que não cabe vira "?". */
function bytesLatin1(texto: string): number[] {
  return Array.from(texto, (c) => (c.charCodeAt(0) < 256 ? c.charCodeAt(0) : 63));
}

/** Um PDF de uma página, em Helvetica, com uma linha de texto por item. Válido o bastante para qualquer leitor. */
export function gerarPdfMinimo(linhas: string[]): Uint8Array {
  const escapar = (t: string) => t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const conteudo = ["BT", "/F1 10 Tf", "14 TL", "48 800 Td", ...linhas.map((l) => `(${escapar(l)}) Tj T*`), "ET"].join("\n");
  const fluxo = bytesLatin1(conteudo);
  const objetos: number[][] = [
    bytesLatin1("<< /Type /Catalog /Pages 2 0 R >>"),
    bytesLatin1("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    bytesLatin1("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"),
    bytesLatin1("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
    [...bytesLatin1(`<< /Length ${fluxo.length} >>\nstream\n`), ...fluxo, ...bytesLatin1("\nendstream")],
  ];

  const saida: number[] = bytesLatin1("%PDF-1.4\n");
  const posicoes: number[] = [];
  objetos.forEach((corpo, i) => {
    posicoes.push(saida.length);
    saida.push(...bytesLatin1(`${i + 1} 0 obj\n`), ...corpo, ...bytesLatin1("\nendobj\n"));
  });
  const inicioXref = saida.length;
  const tabela = [`xref\n0 ${objetos.length + 1}\n`, "0000000000 65535 f \n", ...posicoes.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`)].join("");
  saida.push(...bytesLatin1(`${tabela}trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`));
  return Uint8Array.from(saida);
}
