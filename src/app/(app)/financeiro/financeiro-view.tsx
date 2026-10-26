"use client";

import { CurrencyCircleDollar } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select } from "@/components/ui/field";
import { Carregando } from "@/components/ui/spinner";
import { dataBR, dataHoraBR, hojeNoEscritorio, moeda, numero } from "@/lib/format";
import { NOTAS_FISCAIS_ATIVAS } from "@/lib/notas/modo";
import { useFinanceiro } from "@/lib/notas/queries";
import { mesesParaFiltro, rotuloDoMes } from "@/lib/notas/regras";
import type { Financeiro } from "@/lib/types";
import { comParametros, urlComParametros } from "@/lib/url";

import { ConsultaEmLote } from "./consulta-em-lote";
import { SelicDasEstimativas } from "./selic";

const ROTA = "/financeiro";
const MESES = 12;

/**
 * O dinheiro do escritório num mês: quanto os clientes emitiram (lido do portal de Salvador), as guias em aberto, vencidas e
 * pagas, a evolução dos últimos meses e a situação de cada cliente. É só leitura sobre o que o sistema já guarda; o mês fica
 * na URL.
 */
export function FinanceiroView() {
  const parametros = useSearchParams();
  const router = useRouter();
  const hoje = hojeNoEscritorio();
  const meses = mesesParaFiltro(hoje, MESES, parametros.get("mes") ?? "");
  const mesParam = parametros.get("mes") ?? "";
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam) ? mesParam : meses[0].valor;
  const { data, isPending, isError, refetch } = useFinanceiro(mes);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[25px] font-semibold sm:text-[32px]">Financeiro</h1>
        <Field rotulo="Mês">
          {(a) => (
            <Select
              {...a}
              value={mes}
              onChange={(e) => router.replace(urlComParametros(ROTA, comParametros(parametros, { mes: e.target.value === meses[0].valor ? null : e.target.value })))}
            >
              {meses.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.rotulo}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {isPending && (
        <div className="mt-8">
          <Carregando texto="Carregando o financeiro…" />
        </div>
      )}

      {isError && (
        <div className="mt-8 rounded-ui border border-crimson/40 p-4">
          <p className="text-crimson">Não foi possível carregar o financeiro.</p>
          <Button className="mt-3" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {data && (
        <>
          <Resumo dados={data} />
          {NOTAS_FISCAIS_ATIVAS && <ConsultaEmLote mes={data.mes} emitido={data.emitido} />}
          <Evolucao dados={data} />
          <Clientes dados={data} />
          <SelicDasEstimativas />
        </>
      )}
    </div>
  );
}

function Indicador({ rotulo, valor, detalhe, tom }: { rotulo: string; valor: string; detalhe: string; tom?: "problema" }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <dt className="text-muted">{rotulo}</dt>
      <dd className={`font-display text-[28px] font-bold leading-none tabular-nums ${tom === "problema" ? "text-crimson" : ""}`}>{valor}</dd>
      <dd className="text-[13px] text-muted">{detalhe}</dd>
    </div>
  );
}

function Resumo({ dados }: { dados: Financeiro }) {
  const { guias, emitido } = dados;
  const nomeDoMes = rotuloDoMes(dados.mes);
  return (
    <section aria-label={`Resumo de ${nomeDoMes}`} className="mt-6 rounded-ui border border-line bg-paper">
      <dl className="grid grid-cols-[minmax(0,1fr)] divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {NOTAS_FISCAIS_ATIVAS && (
          <Indicador
            rotulo={`Emitido pelos clientes em ${nomeDoMes}`}
            valor={emitido.clientesConsultados > 0 ? moeda(emitido.valor) : "—"}
            detalhe={
              emitido.clientesConsultados > 0
                ? `${numero(emitido.notas)} ${emitido.notas === 1 ? "nota" : "notas"} · ${emitido.clientesConsultados} de ${emitido.clientesComAcesso} clientes consultados${emitido.guiasQuitadas > 0 ? ` · ${moeda(emitido.guiasQuitadas)} em guias quitadas` : ""}`
                : "Nenhum cliente consultado neste mês"
            }
          />
        )}
        <Indicador rotulo="Guias em aberto" valor={moeda(guias.emAberto)} detalhe={`${numero(guias.quantidadeEmAberto)} ${guias.quantidadeEmAberto === 1 ? "guia" : "guias"}`} />
        <Indicador
          rotulo="Guias vencidas"
          valor={moeda(guias.vencidas)}
          detalhe={`${numero(guias.quantidadeVencidas)} ${guias.quantidadeVencidas === 1 ? "guia" : "guias"}${
            guias.quantidadeVencidas > 0 ? ` · pagas hoje, cerca de ${moeda(guias.vencidasPagasHoje)} (estimativa${guias.vencidasSemEstimativa > 0 ? `; ${guias.vencidasSemEstimativa} sem estimativa entram pelo valor original` : ""})` : ""
          }`}
          tom={guias.quantidadeVencidas > 0 ? "problema" : undefined}
        />
        <Indicador
          rotulo={`Guias pagas em ${nomeDoMes}`}
          valor={moeda(guias.pagasNoMes)}
          detalhe={`${numero(guias.quantidadePagasNoMes)} ${guias.quantidadePagasNoMes === 1 ? "guia" : "guias"}`}
        />
      </dl>
      <p className="border-t border-line px-5 py-3 text-[13px] text-muted">
        Em aberto e vencidas valem para hoje, qualquer que seja o mês escolhido; o mês escolhido define o emitido e as guias pagas.{" "}
        <Link href="/guias?situacao=VENCIDA" className="font-semibold text-accent-text hover:underline">
          Ver guias vencidas
        </Link>
      </p>
    </section>
  );
}

function Evolucao({ dados }: { dados: Financeiro }) {
  const maior = Math.max(1, ...dados.serie.flatMap((m) => [m.emitido, m.pago]));
  return (
    <section aria-labelledby="evolucao" className="mt-4 rounded-ui border border-line bg-paper">
      <h2 id="evolucao" className="border-b border-line px-5 py-3 font-display text-lg font-semibold">
        Últimos {dados.serie.length} meses
      </h2>
      <div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line text-[13px] text-muted">
              <th scope="col" className="px-3 py-2 font-medium sm:px-5">
                Mês
              </th>
              {NOTAS_FISCAIS_ATIVAS && (
                <th scope="col" className="px-3 py-2 font-medium">
                  Emitido pelos clientes
                </th>
              )}
              <th scope="col" className="px-3 py-2 font-medium">
                Guias pagas
              </th>
            </tr>
          </thead>
          <tbody>
            {dados.serie.map((m) => (
              <tr key={m.mes} className="border-b border-line/60 last:border-0">
                <th scope="row" className="px-3 py-2 font-normal capitalize sm:px-5">
                  {rotuloDoMes(m.mes)}
                </th>
                {NOTAS_FISCAIS_ATIVAS && (
                  <td className="px-2 py-2 sm:px-3">
                    <Barra valor={m.emitido} maior={maior} cor="bg-accent" />
                  </td>
                )}
                <td className="px-2 py-2 sm:px-3">
                  <Barra valor={m.pago} maior={maior} cor="bg-moss" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** A barra é só enfeite: o valor por extenso ao lado é o que vale (leitor de tela e quem não distingue cores). */
function Barra({ valor, maior, cor }: { valor: number; maior: number; cor: string }) {
  return (
    <span className="flex items-center gap-3">
      <span aria-hidden className="hidden h-2 w-28 shrink-0 overflow-hidden rounded-full bg-line/50 sm:block">
        <span className={`block h-full rounded-full ${cor}`} style={{ width: `${Math.round((valor / maior) * 100)}%` }} />
      </span>
      <span className="tabular-nums">{valor > 0 ? moeda(valor) : "—"}</span>
    </span>
  );
}

function Clientes({ dados }: { dados: Financeiro }) {
  return (
    <section aria-labelledby="por-cliente" className="mt-4 rounded-ui border border-line bg-paper">
      <h2 id="por-cliente" className="border-b border-line px-5 py-3 font-display text-lg font-semibold">
        Por cliente
      </h2>
      {dados.clientes.length === 0 ? (
        <EmptyState
          icone={<CurrencyCircleDollar size={40} weight="duotone" aria-hidden />}
          titulo="Nada para mostrar ainda"
          texto="Aparecem aqui os clientes com guia em aberto e, depois de consultar o portal, o que cada um emitiu no mês."
        >
          <Link href="/guias?novo=1" className="font-semibold text-accent-text hover:underline">
            Cadastrar uma guia
          </Link>
        </EmptyState>
      ) : (
        <>
          <ul aria-label="Clientes" className="divide-y divide-line/60 sm:hidden">
            {dados.clientes.map((c) => (
              <li key={c.clienteId} className="px-4 py-3">
                <Link href={`/clientes?id=${c.clienteId}`} className="break-words font-semibold text-accent-text hover:underline">
                  {c.nome}
                </Link>
                <dl className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 text-[13px]">
                  {NOTAS_FISCAIS_ATIVAS && (
                    <>
                      <dt className="text-muted">Emitido no mês</dt>
                      <dd className="text-right tabular-nums">{c.consultado ? `${moeda(c.emitido)} · ${c.notas} ${c.notas === 1 ? "nota" : "notas"}` : "Não consultado"}</dd>
                    </>
                  )}
                  {NOTAS_FISCAIS_ATIVAS && c.consultado && c.quitadoNoPortal > 0 && (
                    <>
                      <dt className="text-muted">Guia quitada no portal</dt>
                      <dd className="text-right tabular-nums">{moeda(c.quitadoNoPortal)}</dd>
                    </>
                  )}
                  <dt className="text-muted">Guias em aberto</dt>
                  <dd className="text-right tabular-nums">{c.guiasEmAberto > 0 ? `${moeda(c.emAberto)} · ${c.guiasEmAberto} ${c.guiasEmAberto === 1 ? "guia" : "guias"}` : "—"}</dd>
                  <dt className="text-muted">Vencido</dt>
                  <dd className={`text-right tabular-nums ${c.vencido > 0 ? "font-semibold text-crimson" : ""}`}>{c.vencido > 0 ? moeda(c.vencido) : "—"}</dd>
                  <dt className="text-muted">Próximo vencimento</dt>
                  <dd className="text-right tabular-nums">{c.proximoVencimento ? dataBR(c.proximoVencimento) : "—"}</dd>
                </dl>
              </li>
            ))}
          </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[44rem] text-left">
            <thead>
              <tr className="border-b border-line text-[13px] text-muted">
                <th scope="col" className="px-5 py-2 font-medium">
                  Cliente
                </th>
                {NOTAS_FISCAIS_ATIVAS && (
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Emitido no mês
                  </th>
                )}
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Guias em aberto
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Vencido
                </th>
                <th scope="col" className="px-5 py-2 font-medium">
                  Próximo vencimento
                </th>
              </tr>
            </thead>
            <tbody>
              {dados.clientes.map((c) => (
                <tr key={c.clienteId} className="border-b border-line/60 last:border-0">
                  <th scope="row" className="px-5 py-2.5 font-normal">
                    <Link href={`/clientes?id=${c.clienteId}`} className="font-semibold text-accent-text hover:underline">
                      {c.nome}
                    </Link>
                  </th>
                  {NOTAS_FISCAIS_ATIVAS && (
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {c.consultado ? (
                        <>
                          {moeda(c.emitido)}
                          <span className="block text-[13px] text-muted">
                            {c.notas} {c.notas === 1 ? "nota" : "notas"}
                            {c.quitadoNoPortal > 0 ? ` · ${moeda(c.quitadoNoPortal)} quitado` : ""}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">Não consultado</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {c.guiasEmAberto > 0 ? (
                      <Link href={`/guias?clienteId=${c.clienteId}`} className="hover:underline">
                        {moeda(c.emAberto)}
                        <span className="block text-[13px] text-muted">
                          {c.guiasEmAberto} {c.guiasEmAberto === 1 ? "guia" : "guias"}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${c.vencido > 0 ? "font-semibold text-crimson" : "text-muted"}`}>
                    {c.vencido > 0 ? moeda(c.vencido) : "—"}
                  </td>
                  <td className="px-5 py-2.5 tabular-nums">{c.proximoVencimento ? dataBR(c.proximoVencimento) : <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      {dados.emitido.ultimaConsulta && NOTAS_FISCAIS_ATIVAS && (
        <p className="border-t border-line px-5 py-3 text-[13px] text-muted">Última consulta ao portal neste mês: {dataHoraBR(dados.emitido.ultimaConsulta)}.</p>
      )}
    </section>
  );
}
