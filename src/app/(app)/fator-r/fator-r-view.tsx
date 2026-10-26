"use client";

import { Percent } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { ClienteCombobox } from "@/components/clientes/cliente-combobox";
import { PilulaDoAnexo } from "@/components/fator-r/pilula-do-anexo";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select } from "@/components/ui/field";
import { Carregando } from "@/components/ui/spinner";
import { formatarFator, rotuloDaBase } from "@/lib/fator-r";
import { hojeNoEscritorio, moeda } from "@/lib/format";
import { mesesParaFiltro, rotuloDoMes } from "@/lib/notas/regras";
import { useFatorR } from "@/lib/queries-fatorr";
import { comParametros, urlComParametros } from "@/lib/url";

import { FatorRDoClienteView } from "./fator-r-cliente";

const ROTA = "/fator-r";

/**
 * Fator R por cliente: folha ÷ receita dos 12 meses anteriores; com 28% ou mais a atividade do Anexo V é tributada pelo Anexo III.
 * A lista mostra os clientes que já têm folha ou receita informada, os mais perto do limite primeiro; o cliente aberto e o mês
 * de apuração ficam na URL.
 */
export function FatorRView() {
  const parametros = useSearchParams();
  const router = useRouter();
  const meses = mesesParaFiltro(hojeNoEscritorio(), 12, parametros.get("mes") ?? "");
  const mesParam = parametros.get("mes") ?? "";
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam) ? mesParam : meses[0].valor;
  const clienteParam = parametros.get("cliente");
  const clienteId = clienteParam && /^\d+$/.test(clienteParam) ? Number(clienteParam) : null;

  const href = (patch: Record<string, string | null>) => urlComParametros(ROTA, comParametros(parametros, patch));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[25px] font-semibold sm:text-[32px]">Fator R</h1>
        <Field rotulo="Mês de apuração">
          {(a) => (
            <Select {...a} value={mes} onChange={(e) => router.replace(href({ mes: e.target.value === meses[0].valor ? null : e.target.value }))}>
              {meses.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.rotulo}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <p role="note" className="mt-4 rounded-ui border border-line bg-paper px-4 py-3 text-[13px] text-muted">
        <strong className="text-ink">Fator R</strong> = folha de salários ÷ receita bruta dos <strong className="text-ink">12 meses anteriores</strong> ao mês de
        apuração (o próprio mês não entra). Com <strong className="text-ink">28% ou mais</strong>, a atividade que seria do Anexo V é tributada pelo Anexo III. A
        folha inclui salários, pró-labore, FGTS e INSS patronal. <strong className="text-ink">É uma estimativa:</strong> confira a regra com a contabilidade antes
        de usar o número em guia.
      </p>

      {clienteId !== null ? (
        <FatorRDoClienteView clienteId={clienteId} mes={mes} hrefLista={href({ cliente: null })} />
      ) : (
        <Lista mes={mes} hrefCliente={(id) => href({ cliente: String(id) })} aoEscolher={(id) => router.push(href({ cliente: String(id) }))} />
      )}
    </div>
  );
}

function Lista({ mes, hrefCliente, aoEscolher }: { mes: string; hrefCliente: (id: number) => string; aoEscolher: (id: number) => void }) {
  const { data, isPending, isError, refetch } = useFatorR(mes);

  return (
    <>
      <div className="mt-4 max-w-md">
        <Field rotulo="Acompanhar outro cliente" dica="Busque o cliente e informe a folha e a receita dos meses.">
          {(a) => <ClienteCombobox {...a} valor={null} onChange={(c) => c && aoEscolher(c.id)} />}
        </Field>
      </div>

      {isPending && (
        <div className="mt-8">
          <Carregando texto="Calculando o Fator R…" />
        </div>
      )}
      {isError && (
        <div className="mt-6 rounded-ui border border-crimson/40 p-4">
          <p className="text-crimson">Não foi possível carregar o Fator R.</p>
          <Button className="mt-3" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {data && (
        <section aria-labelledby="clientes-fator-r" className="mt-4 rounded-ui border border-line bg-paper">
          <h2 id="clientes-fator-r" className="border-b border-line px-5 py-3 font-display text-lg font-semibold">
            Clientes em {rotuloDoMes(data.mes)}
          </h2>
          {data.clientes.length === 0 ? (
            <EmptyState
              icone={<Percent size={40} weight="duotone" aria-hidden />}
              titulo="Nenhum cliente acompanhado ainda"
              texto="Escolha um cliente acima e informe a folha de pagamento e a receita de cada mês. A receita dos clientes de Salvador consultados no portal entra sozinha."
            />
          ) : (
            <>
              <ul aria-label="Clientes" className="divide-y divide-line/60 sm:hidden">
                {data.clientes.map((c) => (
                  <li key={c.clienteId} className="px-4 py-3">
                    <Link href={hrefCliente(c.clienteId)} className="break-words font-semibold text-accent-text hover:underline">
                      {c.nome}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="font-display text-lg font-bold tabular-nums">{formatarFator(c.resultado.fator)}</span>
                      <PilulaDoAnexo resultado={c.resultado} />
                      <span className="text-muted">base: {rotuloDaBase(c.resultado)}</span>
                    </p>
                    {c.resultado.anexo === "V" && <p className="text-[13px] text-muted">Faltam {moeda(c.resultado.faltaDeFolha)} de folha para 28%.</p>}
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
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Fator R
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Anexo
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Folha (12 meses)
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Receita (12 meses)
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Base
                      </th>
                      <th scope="col" className="px-5 py-2 text-right font-medium">
                        Falta de folha p/ 28%
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clientes.map((c) => (
                      <tr key={c.clienteId} className="border-b border-line/60 last:border-0">
                        <th scope="row" className="px-5 py-2.5 font-normal">
                          <Link href={hrefCliente(c.clienteId)} className="font-semibold text-accent-text hover:underline">
                            {c.nome}
                          </Link>
                        </th>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatarFator(c.resultado.fator)}</td>
                        <td className="px-3 py-2.5">
                          <PilulaDoAnexo resultado={c.resultado} />
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{c.resultado.mesesConsiderados > 0 ? moeda(c.resultado.folha12) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{c.resultado.mesesConsiderados > 0 ? moeda(c.resultado.receita12) : "—"}</td>
                        <td className="px-3 py-2.5 text-muted">{rotuloDaBase(c.resultado)}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">{c.resultado.anexo === "V" ? moeda(c.resultado.faltaDeFolha) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}
