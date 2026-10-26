import Link from "next/link";

import { formatarDocumento } from "@/lib/documento";
import { dataBR, moeda } from "@/lib/format";
import { CAMPOS_DE_RETENCAO, ROTULO_RETENCAO, totalRetido } from "@/lib/notas/regras";
import { formatarCodigoServico, descricaoDoServico } from "@/lib/notas/servicos";
import type { NotaFiscal } from "@/lib/types";

/** Os dados de uma nota que já saiu (enviada, autorizada, cancelada): só leitura, sem campos desabilitados. */
export function NotaResumo({ nota }: { nota: NotaFiscal }) {
  const emitida = nota.status === "AUTORIZADA" || nota.status === "CANCELADA";
  const retido = totalRetido(nota.retencoes);
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      <Item rotulo="Prestador (cliente)">
        {nota.clienteId !== null ? (
          <Link href={`/clientes?id=${nota.clienteId}`} className="text-accent-text hover:underline">
            {nota.prestadorNome}
          </Link>
        ) : (
          nota.prestadorNome
        )}
        <span className="block text-[13px] font-normal tabular-nums text-muted">{formatarDocumento(nota.prestadorDocumento)}</span>
      </Item>
      <Item rotulo="Tomador">
        {nota.tomadorNome}
        <span className="block text-[13px] font-normal tabular-nums text-muted">
          {formatarDocumento(nota.tomadorDocumento)}
          {nota.tomadorEmail && ` · ${nota.tomadorEmail}`}
        </span>
      </Item>
      <Item rotulo="Serviço prestado" largo>
        {formatarCodigoServico(nota.codigoServico)} · {descricaoDoServico(nota.codigoServico) ?? "—"}
        <span className="mt-0.5 block whitespace-pre-line text-[13px] font-normal text-muted">{nota.descricaoServico}</span>
      </Item>
      <Item rotulo="Data do serviço (competência)">{dataBR(nota.competencia)}</Item>
      <Item rotulo="Valor do serviço">
        <span className="tabular-nums">{moeda(nota.valor)}</span>
      </Item>
      <Item rotulo="ISS">
        {nota.issRetido
          ? "Retido pelo tomador"
          : nota.valorIss !== null
            ? `${moeda(nota.valorIss)} (${String(nota.aliquotaIss).replace(".", ",")}%)`
            : emitida
              ? "Recolhido no DAS (Simples Nacional)"
              : "Calculado pelo sistema nacional na emissão"}
      </Item>
      {retido > 0 && (
        <Item rotulo="Retenções federais">
          <span className="tabular-nums">{CAMPOS_DE_RETENCAO.filter((c) => nota.retencoes[c]).map((c) => `${ROTULO_RETENCAO[c]} ${moeda(nota.retencoes[c]!)}`).join(" · ")}</span>
          <span className="block text-[13px] font-normal text-muted">
            Total retido {moeda(retido)} · líquido a receber {moeda(nota.valor - retido)}
          </span>
        </Item>
      )}
      {nota.informacoesComplementares && (
        <Item rotulo="Informações complementares" largo>
          <span className="whitespace-pre-line font-normal">{nota.informacoesComplementares}</span>
        </Item>
      )}
    </dl>
  );
}

export function Item({ rotulo, largo = false, children }: { rotulo: string; largo?: boolean; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 ${largo ? "sm:col-span-2" : ""}`}>
      <dt className="text-[13px] text-muted">{rotulo}</dt>
      <dd className="break-words font-medium">{children}</dd>
    </div>
  );
}
