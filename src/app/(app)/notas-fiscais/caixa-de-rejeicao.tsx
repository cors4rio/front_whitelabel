"use client";

import { WarningOctagon } from "@phosphor-icons/react";
import Link from "next/link";

import { orientacaoParaErro, ROTULO_DO_CAMPO } from "@/lib/notas/regras";
import type { CampoNota, ErroFiscal } from "@/lib/types";

import { focarCampoDaNota } from "./nota-form";

const CAMPOS_DA_CONFIGURACAO: CampoNota[] = ["prestador", "certificado"];

/**
 * O motivo da rejeição em destaque no topo do detalhe (docs/ui-ux.md, seção 8): o código e o
 * texto oficiais do sistema nacional, o que fazer, e um atalho para o campo (ou a configuração) que precisa mudar.
 */
export function CaixaDeRejeicao({ erros, ehAdmin }: { erros: ErroFiscal[]; ehAdmin: boolean }) {
  if (erros.length === 0) return null;
  return (
    <section aria-label="Motivo da rejeição" className="rounded-ui border border-crimson bg-crimson/5 px-4 py-3.5">
      <h3 className="flex items-center gap-2 font-semibold text-crimson">
        <WarningOctagon size={18} weight="bold" aria-hidden />
        Motivo da rejeição
      </h3>
      <ul className="mt-2 flex flex-col gap-3">
        {erros.map((erro) => {
          const orientacao = orientacaoParaErro(erro.codigo);
          const naConfiguracao = erro.campo !== null && CAMPOS_DA_CONFIGURACAO.includes(erro.campo);
          return (
            <li key={`${erro.codigo}-${erro.mensagem}`}>
              <p>
                <span className="font-semibold tabular-nums">{erro.codigo}</span> · {erro.mensagem}
              </p>
              {orientacao && <p className="mt-0.5 text-[13px] font-medium">{orientacao}</p>}
              {erro.campo && !naConfiguracao && (
                <button
                  type="button"
                  onClick={() => focarCampoDaNota(erro.campo!)}
                  className="mt-1 text-[13px] font-medium text-accent-text underline underline-offset-2"
                >
                  Ir para “{ROTULO_DO_CAMPO[erro.campo]}”
                </button>
              )}
              {naConfiguracao && ehAdmin && (
                <Link href="/notas-fiscais/configuracao" className="mt-1 inline-block text-[13px] font-medium text-accent-text underline underline-offset-2">
                  Abrir a configuração fiscal
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
