"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/lib/auth";
import { formatarDocumento } from "@/lib/documento";
import { dataBR, moeda } from "@/lib/format";
import { AVISO_CANAL_MUNICIPAL, CAMPOS_DE_RETENCAO, ROTULO_AMBIENTE, ROTULO_CANAL_CURTO, ROTULO_RETENCAO, totalRetido } from "@/lib/notas/regras";
import { formatarCodigoServico, descricaoDoServico } from "@/lib/notas/servicos";
import type { AmbienteNfse, CanalDoPerfil, PerfilFiscal, RetencoesFederais } from "@/lib/types";

export interface ResumoDaEmissao {
  prestador: string;
  prestadorDocumento: string;
  tomador: string;
  tomadorDocumento: string;
  competencia: string;
  codigoServico: string;
  descricao: string;
  valor: number;
  issRetido: boolean;
  retencoes: RetencoesFederais;
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  emitindo: boolean;
  onConfirmar: () => void;
  /** Os dados fiscais do prestador (cliente): é deles que depende poder emitir. */
  perfil: PerfilFiscal | undefined;
  /** O canal por onde esta nota sai, com o que falta para ele. */
  canal: CanalDoPerfil | undefined;
  ambiente: AmbienteNfse | undefined;
  resumo: ResumoDaEmissao;
  /** A nota foi rejeitada antes e está sendo corrigida: é uma nova tentativa. */
  reemissao: boolean;
}

/**
 * Última parada antes de a nota sair para o sistema nacional. Mostra o que vai na nota e em que ambiente, porque
 * uma nota autorizada em produção só se desfaz por cancelamento, dentro do prazo do município. O foco começa em
 * “Voltar e revisar”: confirmar é uma escolha deliberada, não um Enter distraído.
 */
export function EmitirDialog({ aberto, onFechar, emitindo, onConfirmar, perfil, canal, ambiente, resumo, reemissao }: Props) {
  const { estado } = useAuth();
  const ehAdmin = estado.usuario?.papel === "ADMIN";
  const pendencias = canal?.prontidao.filter((i) => i.situacao === "PENDENTE") ?? [];
  const bloqueada = !perfil || !canal || pendencias.length > 0;
  const producao = ambiente === "PRODUCAO";
  const retido = totalRetido(resumo.retencoes);

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo={reemissao ? "Emitir a nota de novo?" : "Emitir a nota fiscal?"}>
      {ambiente && (
        <p className={`mb-3 rounded-ui border px-3 py-2 text-[13px] ${producao ? "border-line" : "border-amber/70 bg-amber/10"}`} role="note">
          {producao ? (
            <>
              <strong>Ambiente de produção:</strong> a nota terá validade fiscal. Depois de autorizada, só se desfaz por cancelamento, dentro do prazo do município.
            </>
          ) : (
            <>
              <strong>Ambiente de {ROTULO_AMBIENTE[ambiente].toLowerCase()}:</strong> a nota é de teste e não tem validade fiscal.
            </>
          )}
        </p>
      )}

      {canal?.canal === "MUNICIPAL_SALVADOR" && (
        <p className="mb-3 rounded-ui border border-amber/70 bg-amber/10 px-3 py-2 text-[13px]" role="note">
          <strong>Emissão sem certificado.</strong> {AVISO_CANAL_MUNICIPAL}
        </p>
      )}

      <dl className="grid gap-x-4 gap-y-2.5 sm:grid-cols-[auto_minmax(0,1fr)]">
        {canal && <Linha rotulo="Canal">{ROTULO_CANAL_CURTO[canal.canal]}</Linha>}
        <Linha rotulo="Prestador">
          {resumo.prestador}
          <span className="block text-[13px] tabular-nums text-muted">{formatarDocumento(resumo.prestadorDocumento)}</span>
        </Linha>
        <Linha rotulo="Tomador">
          {resumo.tomador}
          {resumo.tomadorDocumento && <span className="block text-[13px] tabular-nums text-muted">{formatarDocumento(resumo.tomadorDocumento)}</span>}
        </Linha>
        <Linha rotulo="Serviço">
          {formatarCodigoServico(resumo.codigoServico)} · {descricaoDoServico(resumo.codigoServico)}
          <span className="mt-0.5 block text-[13px] text-muted">{resumo.descricao}</span>
        </Linha>
        <Linha rotulo="Competência">{dataBR(resumo.competencia)}</Linha>
        <Linha rotulo="Valor">
          <strong className="tabular-nums">{moeda(resumo.valor)}</strong>
        </Linha>
        <Linha rotulo="ISS retido">{resumo.issRetido ? "Sim, pelo tomador" : "Não"}</Linha>
        {retido > 0 && (
          <Linha rotulo="Retenções federais">
            <span className="tabular-nums">
              {CAMPOS_DE_RETENCAO.filter((c) => resumo.retencoes[c]).map((c) => `${ROTULO_RETENCAO[c]} ${moeda(resumo.retencoes[c]!)}`).join(" · ")}
            </span>
            <span className="block text-[13px] text-muted">Total retido {moeda(retido)} · líquido a receber {moeda(resumo.valor - retido)}</span>
          </Linha>
        )}
      </dl>

      {bloqueada && (
        <div role="alert" className="mt-4 rounded-ui border border-crimson bg-crimson/5 px-3 py-2.5 text-[13px]">
          <p className="font-semibold text-crimson">Este cliente ainda não está pronto para emitir</p>
          <ul className="mt-1 list-disc pl-5">
            {pendencias.map((p) => (
              <li key={p.id}>{p.detalhe}</li>
            ))}
          </ul>
          <p className="mt-1.5">
            {ehAdmin && perfil ? (
              <Link href={`/notas-fiscais/configuracao?cliente=${perfil.clienteId}`} className="font-medium text-accent-text underline underline-offset-2">
                Abrir os dados fiscais de {perfil.clienteNome}
              </Link>
            ) : (
              "Peça a um administrador para completar os dados fiscais do cliente."
            )}{" "}
            Você pode salvar a nota como rascunho e emitir depois.
          </p>
        </div>
      )}

      {/* Rodapé fixo na base da área rolável: em tela baixa o corpo rola, mas os botões não somem. */}
      <div className="sticky bottom-0 -mx-5 -mb-4 mt-5 flex flex-wrap justify-end gap-2 border-t border-line bg-paper px-5 py-3">
        <Button data-autofocus onClick={onFechar} disabled={emitindo}>
          Voltar e revisar
        </Button>
        <Button variante="primario" carregando={emitindo} disabled={bloqueada} onClick={onConfirmar}>
          Emitir nota
        </Button>
      </div>
    </Modal>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-[13px] text-muted sm:pt-0.5">{rotulo}</dt>
      <dd className="min-w-0 break-words font-medium">{children}</dd>
    </>
  );
}
