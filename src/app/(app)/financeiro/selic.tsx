"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { dataBR, hojeNoEscritorio } from "@/lib/format";
import { parseDinheiro } from "@/lib/dinheiro";
import { mesesParaFiltro, rotuloDoMes } from "@/lib/notas/regras";
import { useBuscarSelicNoBanco, useDefinirSelic, useSelic } from "@/lib/queries-guias";

const percentual = (taxa: number) => `${taxa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;

/**
 * A Selic acumulada de cada mês fechado, que entra nos juros da estimativa de guias federais em atraso. Vem do Banco Central
 * (série 4390) e se atualiza sozinha todo dia; o administrador pode buscar agora ou digitar um mês (a digitada não é sobrescrita).
 */
export function SelicDasEstimativas() {
  const { estado } = useAuth();
  const ehAdmin = estado.usuario?.papel === "ADMIN";
  const toast = useToast();
  const { data } = useSelic(12);
  const definir = useDefinirSelic();
  const buscar = useBuscarSelicNoBanco();
  const meses = mesesParaFiltro(hojeNoEscritorio(), 13).slice(1); // só meses fechados: do mês passado para trás
  const [mes, setMes] = useState(meses[0].valor);
  const [taxa, setTaxa] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const ultimoFechado = meses[0].valor;
  const falta = data !== undefined && !data.some((s) => s.competencia === ultimoFechado);

  async function aoSalvar(e: React.FormEvent) {
    e.preventDefault();
    const lida = parseDinheiro(taxa);
    if (lida === null || lida > 30) {
      setErro("Informe a Selic do mês em %, como 1,08.");
      return;
    }
    setErro(null);
    try {
      await definir.mutateAsync({ competencia: mes, taxa: lida });
      toast.sucesso(`Selic de ${rotuloDoMes(mes)} salva`);
      setTaxa("");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  }

  async function aoBuscar() {
    try {
      const { novos } = await buscar.mutateAsync();
      toast.sucesso(novos > 0 ? `${novos} mês(es) novo(s) do Banco Central` : "A tabela já está em dia");
    } catch (err) {
      toast.erro(err instanceof Error ? err.message : "Não foi possível buscar no Banco Central.");
    }
  }

  return (
    <section id="selic" aria-labelledby="selic-titulo" className="mt-4 rounded-ui border border-line bg-paper">
      <h2 id="selic-titulo" className="border-b border-line px-5 py-3 font-display text-lg font-semibold">
        Selic usada nas estimativas
      </h2>
      <div className="px-5 py-4">
        <p className="text-[13px] text-muted">
          Os juros de uma guia federal em atraso somam a Selic de cada mês, do seguinte ao vencimento até o anterior ao pagamento, mais 1% no mês do pagamento.
          A tabela vem do Banco Central e se atualiza sozinha.
        </p>
        {falta && (
          <p role="alert" className="mt-3 rounded-ui border border-amber/70 bg-amber/10 px-3 py-2 text-[13px]">
            <strong>Falta a Selic de {rotuloDoMes(ultimoFechado)}.</strong> Estimativas de atrasos que passam por esse mês ficam sem os juros até alguém buscá-la ou
            digitá-la.
          </p>
        )}

        {data && (
          <ul aria-label="Selic por mês" className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-x-8 sm:grid-cols-2">
            {data.map((s) => (
              <li key={s.competencia} className="flex items-center justify-between gap-3 border-b border-line/60 py-1.5">
                <span className="capitalize">{rotuloDoMes(s.competencia)}</span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">{percentual(s.taxa)}</span>
                  <Pill tom={s.fonte === "MANUAL" ? "atencao" : "neutro"}>{s.fonte === "MANUAL" ? "Digitada" : "Banco Central"}</Pill>
                </span>
              </li>
            ))}
          </ul>
        )}
        {data && data[0] && <p className="mt-2 text-[13px] text-muted">Última atualização: {dataBR(data[0].atualizadoEm.slice(0, 10))}.</p>}

        {ehAdmin && (
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <Button variante="secundario" carregando={buscar.isPending} onClick={aoBuscar}>
                Buscar no Banco Central
              </Button>
            </div>
            <form onSubmit={aoSalvar} noValidate className="flex flex-wrap items-end gap-3">
              <Field rotulo="Mês">
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
              <Field rotulo="Selic do mês (%)" erro={erro ?? undefined}>
                {(a) => <Input {...a} inputMode="decimal" placeholder="1,08" value={taxa} onChange={(e) => setTaxa(e.target.value)} />}
              </Field>
              <Button type="submit" variante="secundario" carregando={definir.isPending}>
                Salvar Selic
              </Button>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
