"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, classesBotao } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { dataBR, dataHoraBR, hojeNoEscritorio, moeda } from "@/lib/format";
import { useConsultarPortal, useMovimentosDoPortal } from "@/lib/notas/queries";
import { mesesParaFiltro, rotuloDoMes } from "@/lib/notas/regras";
import type { MovimentoPortal, PerfilFiscal } from "@/lib/types";

import { Item } from "../nota-resumo";

/**
 * O que o cliente emitiu num mês e as guias (DAM) dele, lidos do portal da Prefeitura de Salvador com o login do cliente.
 * É só leitura: o sistema nunca emite nota nem guia no portal. A guia que o portal já emitiu entra também no módulo de Guias,
 * com o PDF, para ser apresentada ao cliente; a que ainda está "a emitir" só aparece aqui. Cada consulta custa uma
 * resolução de captcha e leva até uns dois minutos, por isso só acontece quando alguém pede.
 */
export function MovimentoSecao({ perfil }: { perfil: PerfilFiscal }) {
  const toast = useToast();
  const meses = mesesParaFiltro(hojeNoEscritorio());
  const [mes, setMes] = useState(meses[1].valor); // o mês passado: é o que fecha e gera a guia
  const consultar = useConsultarPortal(perfil.clienteId);
  const { data: movimentos } = useMovimentosDoPortal(perfil.clienteId, true);
  const movimento = movimentos?.find((m) => m.competencia === mes) ?? null;

  async function consultarAgora() {
    try {
      await consultar.mutateAsync(mes);
      toast.sucesso(`Portal consultado: ${rotuloDoMes(mes)}`);
    } catch (erro) {
      toast.erro(erro instanceof Error ? erro.message : "Não foi possível consultar o portal.");
    }
  }

  return (
    <div>
      <p className="mb-3 text-[13px] text-muted">
        Lê no portal da prefeitura, com o login do cliente, quanto ele emitiu no mês e as guias (DAM) do mês. <strong>Só leitura: nada é emitido.</strong> Cada
        consulta usa uma resolução de captcha e leva até uns dois minutos.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <Field rotulo="Mês a consultar">
          {(a) => (
            <Select {...a} value={mes} onChange={(e) => setMes(e.target.value)}>
              {meses.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.rotulo}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button variante="secundario" carregando={consultar.isPending} onClick={consultarAgora}>
          {movimento ? "Consultar de novo" : "Consultar o portal"}
        </Button>
      </div>

      <div aria-live="polite" className="mt-3">
        {consultar.isPending && <p className="text-[13px] text-muted">Entrando no portal e lendo {rotuloDoMes(mes)}… isso pode levar até dois minutos.</p>}
      </div>

      {movimento ? (
        <Resultado movimento={movimento} />
      ) : (
        !consultar.isPending && <p className="mt-1 rounded-ui border border-dashed border-line px-3.5 py-3 text-muted">{rotuloDoMes(mes)} ainda não foi consultado no portal.</p>
      )}
    </div>
  );
}

function Resultado({ movimento }: { movimento: MovimentoPortal }) {
  return (
    <section aria-label={`Movimento de ${rotuloDoMes(movimento.competencia)}`} className="mt-1 rounded-ui border border-line p-3.5">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
        <Item rotulo="Notas emitidas pelo cliente">
          <span className="tabular-nums">{movimento.notasEmitidas}</span>
        </Item>
        <Item rotulo="Valor emitido">
          <span className="tabular-nums">{moeda(movimento.valorEmitido)}</span>
        </Item>
        <Item rotulo="Consultado em">
          <span className="tabular-nums">{dataHoraBR(movimento.consultadoEm)}</span>
        </Item>
      </dl>

      <h3 className="mt-4 text-[13px] font-semibold text-muted">Guias do mês no portal</h3>
      {movimento.guias.length === 0 ? (
        <p className="mt-1">Nenhuma guia (pendente ou quitada) neste mês.</p>
      ) : (
        <div className="mt-1 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left">
            <thead>
              <tr className="border-b border-line text-[13px] text-muted">
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  Incidência
                </th>
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  Vencimento
                </th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                  Valor
                </th>
                <th scope="col" className="py-1.5 font-medium">
                  Guia
                </th>
              </tr>
            </thead>
            <tbody>
              {movimento.guias.map((g, i) => (
                <tr key={`${g.numero ?? "aemitir"}-${i}`} className="border-b border-line/60 last:border-0">
                  <td className="py-2 pr-3">{g.incidencia}</td>
                  <td className="py-2 pr-3 tabular-nums">{g.vencimento ? dataBR(g.vencimento) : "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{g.valor !== null ? moeda(g.valor) : "—"}</td>
                  <td className="py-2">
                    {g.situacao === "QUITADA" ? (
                      <span>
                        Quitada{g.quitadaEm ? ` em ${dataBR(g.quitadaEm)}` : ""} · nº <span className="tabular-nums">{g.numero}</span>
                      </span>
                    ) : g.emitida ? (
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          Emitida · nº <span className="tabular-nums">{g.numero}</span>
                        </span>
                        {g.guiaId !== null && (
                          <Link href={`/guias?id=${g.guiaId}`} className={classesBotao("fantasma", true)}>
                            Abrir em Guias
                          </Link>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted">A emitir no portal — o sistema não emite guias</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
