"use client";

import { CaretLeft } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

import { PilulaDoAnexo } from "@/components/fator-r/pilula-do-anexo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Carregando } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { formatarDinheiroCampo, parseDinheiro } from "@/lib/dinheiro";
import { formatarFator, rotuloDaBase } from "@/lib/fator-r";
import { moeda } from "@/lib/format";
import { rotuloDoMes } from "@/lib/notas/regras";
import { useFatorRDoCliente, useSalvarMesDoFatorR } from "@/lib/queries-fatorr";
import type { MesDoFatorR } from "@/lib/types";

/** O Fator R de um cliente e o histórico de 24 meses para conferir e preencher a folha e a receita de cada mês. */
export function FatorRDoClienteView({ clienteId, mes, hrefLista }: { clienteId: number; mes: string; hrefLista: string }) {
  const { data, isPending, isError, error, refetch } = useFatorRDoCliente(clienteId, mes);

  if (isPending) {
    return (
      <div className="mt-6">
        <Carregando texto="Calculando o Fator R…" />
      </div>
    );
  }
  if (isError || !data) {
    const naoEncontrado = error instanceof ApiError && error.status === 404;
    return (
      <div className="mt-6 rounded-ui border border-crimson/40 p-4">
        <p className="text-crimson">{naoEncontrado ? "Cliente não encontrado. Ele pode ter sido excluído." : "Não foi possível carregar o Fator R do cliente."}</p>
        <div className="mt-3 flex gap-2">
          {!naoEncontrado && <Button onClick={() => refetch()}>Tentar de novo</Button>}
          <Link href={hrefLista} className="inline-flex h-10 items-center px-2 font-semibold text-accent-text hover:underline">
            Voltar para a lista
          </Link>
        </div>
      </div>
    );
  }

  const atual = data.atual;
  return (
    <div className="mt-4">
      <Link href={hrefLista} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent-text hover:underline">
        <CaretLeft size={14} weight="bold" aria-hidden />
        Voltar para a lista
      </Link>

      <section aria-labelledby="resumo-cliente" className="mt-2 rounded-ui border border-line border-l-[3px] border-l-accent bg-paper p-5">
        <h2 id="resumo-cliente" className="break-words font-display text-xl font-semibold">
          <Link href={`/clientes?id=${data.clienteId}`} className="hover:underline">
            {data.nome}
          </Link>
        </h2>
        <p className="text-muted">Fator R em {rotuloDoMes(data.mes)} (usa os 12 meses anteriores)</p>
        <p className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-display text-[clamp(36px,8vw,52px)] font-bold leading-none tabular-nums">{formatarFator(atual.fator)}</span>
          <PilulaDoAnexo resultado={atual} />
        </p>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-3">
          <div>
            <dt className="text-muted">Folha (12 meses)</dt>
            <dd className="font-semibold tabular-nums">{atual.mesesConsiderados > 0 ? moeda(atual.folha12) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Receita (12 meses)</dt>
            <dd className="font-semibold tabular-nums">{atual.mesesConsiderados > 0 ? moeda(atual.receita12) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Base</dt>
            <dd className="font-semibold">{rotuloDaBase(atual)}</dd>
          </div>
        </dl>
        {atual.anexo === "V" && (
          <p className="mt-3">
            Para chegar a 28% faltariam <strong className="tabular-nums">{moeda(atual.faltaDeFolha)}</strong> de folha nesses meses.
          </p>
        )}
        {atual.anexo === "III" && <p className="mt-3">Com 28% ou mais, a atividade do Anexo V é tributada pelo Anexo III.</p>}
        {atual.anexo === null && <p className="mt-3 text-muted">Sem base: informe a folha e a receita dos meses anteriores (a receita de Salvador entra sozinha depois de consultar o portal).</p>}
        {atual.anexo !== null && !atual.completo && (
          <p role="note" className="mt-3 rounded-ui border border-amber/70 bg-amber/10 px-3 py-2 text-[13px]">
            <strong>Base incompleta:</strong> só {rotuloDaBase(atual)} têm folha e receita. O número é uma estimativa até preencher os meses que faltam.
          </p>
        )}
      </section>

      <section aria-labelledby="meses" className="mt-4 rounded-ui border border-line bg-paper">
        <h2 id="meses" className="border-b border-line px-5 py-3 font-display text-lg font-semibold">
          Folha e receita mês a mês
        </h2>
        <p className="px-5 pt-3 text-[13px] text-muted">
          A <strong>receita</strong> só precisa ser digitada quando o portal não a trouxe; se digitar, vale a digitada. Deixe os dois campos vazios e salve para apagar o
          mês. O Fator R de cada linha usa os 12 meses anteriores a ela.
        </p>
        <ul aria-label="Meses" className="divide-y divide-line/60">
          {data.meses.map((m) => (
            // key com os valores: depois de salvar, a linha recomeça com o que o servidor devolveu.
            <LinhaDoMes key={`${m.competencia}|${m.folha}|${m.receitaInformada}`} clienteId={clienteId} mes={m} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function LinhaDoMes({ clienteId, mes }: { clienteId: number; mes: MesDoFatorR }) {
  const toast = useToast();
  const salvar = useSalvarMesDoFatorR(clienteId);
  const inicialFolha = mes.folha !== null ? formatarDinheiroCampo(mes.folha) : "";
  const inicialReceita = mes.receitaInformada !== null ? formatarDinheiroCampo(mes.receitaInformada) : "";
  const [folha, setFolha] = useState(inicialFolha);
  const [receita, setReceita] = useState(inicialReceita);
  const [erro, setErro] = useState<string | null>(null);
  const alterado = folha.trim() !== inicialFolha || receita.trim() !== inicialReceita;
  const nome = rotuloDoMes(mes.competencia);

  async function aoSalvar(e: React.FormEvent) {
    e.preventDefault();
    const f = folha.trim() === "" ? null : parseDinheiro(folha);
    const r = receita.trim() === "" ? null : parseDinheiro(receita);
    if ((folha.trim() !== "" && f === null) || (receita.trim() !== "" && r === null)) {
      setErro("Use um valor em reais, como 1.234,56.");
      return;
    }
    setErro(null);
    try {
      await salvar.mutateAsync({ competencia: mes.competencia, folha: f, receita: r });
      toast.sucesso(f === null && r === null ? `${nome} apagado` : `${nome} salvo`);
    } catch (err) {
      setErro(err instanceof ApiError && Object.values(err.campos).length > 0 ? Object.values(err.campos)[0] : err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  }

  return (
    <li>
      <form onSubmit={aoSalvar} noValidate className="grid grid-cols-[minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_minmax(0,1fr)_9.5rem_auto] sm:px-5">
        <p className="font-semibold capitalize">{nome}</p>
        <Input
          aria-label={`Folha de ${nome}`}
          inputMode="decimal"
          placeholder="Folha (R$)"
          value={folha}
          aria-invalid={erro !== null ? true : undefined}
          onChange={(e) => {
            setFolha(e.target.value);
            setErro(null);
          }}
        />
        <Input
          aria-label={`Receita de ${nome}`}
          inputMode="decimal"
          placeholder={mes.receitaDoPortal !== null ? `Portal: ${moeda(mes.receitaDoPortal)}` : "Receita (R$)"}
          value={receita}
          aria-invalid={erro !== null ? true : undefined}
          onChange={(e) => {
            setReceita(e.target.value);
            setErro(null);
          }}
        />
        <p className="flex flex-wrap items-center gap-2 text-[13px]" aria-label={`Fator R em ${nome}`}>
          <span className="font-semibold tabular-nums">{formatarFator(mes.resultado.fator)}</span>
          <PilulaDoAnexo resultado={mes.resultado} />
        </p>
        <Button type="submit" pequeno variante="secundario" disabled={!alterado} carregando={salvar.isPending} aria-label={`Salvar ${nome}`}>
          Salvar
        </Button>
        {erro && (
          <p role="alert" className="text-[13px] text-crimson sm:col-span-5">
            {erro}
          </p>
        )}
      </form>
    </li>
  );
}
