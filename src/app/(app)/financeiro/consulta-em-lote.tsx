"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { dataHoraBR } from "@/lib/format";
import { useAoTerminarOLote, useCancelarLote, useIniciarLote, useLoteAtual } from "@/lib/notas/queries";
import { rotuloDoMes } from "@/lib/notas/regras";
import type { Financeiro, LoteConsulta, SituacaoNoLote } from "@/lib/types";

const ROTULO_DA_SITUACAO: Record<SituacaoNoLote, string> = {
  JA_CONSULTADO: "Já consultado",
  AGUARDANDO: "Na fila",
  CONSULTANDO: "Consultando…",
  OK: "Consultado",
  ERRO: "Com erro",
  NAO_TENTADO: "Não tentado",
};

const ROTULO_DO_ESTADO: Record<LoteConsulta["estado"], string> = {
  EM_ANDAMENTO: "Consultando o portal…",
  CONCLUIDO: "Consulta concluída",
  CANCELADO: "Consulta cancelada",
  INTERROMPIDO: "Consulta interrompida",
};

/**
 * Consulta o portal de Salvador para todos os clientes de Salvador de uma vez (só leitura). Cada cliente é um login com captcha
 * (custa dinheiro) e leva uns dois minutos, por isso só o ADMIN começa, a confirmação mostra a conta e, por padrão, quem já
 * foi consultado no mês fica de fora.
 */
export function ConsultaEmLote({ mes, emitido }: { mes: string; emitido: Financeiro["emitido"] }) {
  const { estado } = useAuth();
  const ehAdmin = estado.usuario?.papel === "ADMIN";
  const toast = useToast();
  const { data: lote } = useLoteAtual();
  const iniciar = useIniciarLote();
  const cancelar = useCancelarLote();
  const [confirmando, setConfirmando] = useState(false);
  const [somenteFaltantes, setSomenteFaltantes] = useState(true);
  useAoTerminarOLote(lote);

  const rodando = lote?.estado === "EM_ANDAMENTO";
  const faltam = Math.max(0, emitido.clientesComAcesso - emitido.clientesConsultados);
  const aConsultar = somenteFaltantes ? faltam : emitido.clientesComAcesso;

  async function comecar() {
    try {
      await iniciar.mutateAsync({ competencia: mes, somenteFaltantes });
      setConfirmando(false);
      toast.sucesso("Consulta ao portal iniciada");
    } catch (erro) {
      setConfirmando(false);
      toast.erro(erro instanceof Error ? erro.message : "Não foi possível iniciar a consulta.");
    }
  }

  async function parar() {
    try {
      await cancelar.mutateAsync();
      toast.sucesso("Consulta cancelada");
    } catch (erro) {
      toast.erro(erro instanceof Error ? erro.message : "Não foi possível cancelar a consulta.");
    }
  }

  return (
    <section aria-labelledby="portal-lote" className="mt-4 rounded-ui border border-line bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <h2 id="portal-lote" className="font-display text-lg font-semibold">
            Portal de Salvador
          </h2>
          <p className="text-muted">
            {emitido.clientesComAcesso === 0
              ? "Nenhum cliente de Salvador com o acesso ao portal guardado."
              : `${emitido.clientesConsultados} de ${emitido.clientesComAcesso} clientes de Salvador já foram consultados em ${rotuloDoMes(mes)}.`}
          </p>
        </div>
        {ehAdmin && emitido.clientesComAcesso > 0 && (
          <Button variante="secundario" disabled={rodando} onClick={() => setConfirmando(true)}>
            Consultar o portal de todos
          </Button>
        )}
      </div>

      {lote && <Andamento lote={lote} podeCancelar={ehAdmin} cancelando={cancelar.isPending} aoCancelar={parar} />}

      <Modal aberto={confirmando} onFechar={() => setConfirmando(false)} titulo="Consultar o portal de todos os clientes?" largura="md">
        <p>
          O sistema entra no portal da prefeitura, um cliente por vez, e lê o que cada um emitiu em <strong>{rotuloDoMes(mes)}</strong> e as guias do mês.{" "}
          <strong>Só leitura: nada é emitido.</strong>
        </p>
        <p className="mt-3 text-muted">
          Cada cliente usa uma resolução de captcha (custo por consulta) e leva até uns dois minutos. A consulta continua mesmo se você sair desta tela.
        </p>
        <label className="mt-4 flex items-start gap-2.5">
          <input type="checkbox" className="mt-1 size-4" checked={somenteFaltantes} onChange={(e) => setSomenteFaltantes(e.target.checked)} />
          <span>
            Só os que ainda não foram consultados neste mês <span className="text-muted">(recomendado)</span>
          </span>
        </label>
        <p className="mt-4 rounded-ui border border-line bg-line/20 px-3 py-2.5">
          <strong>{aConsultar}</strong> {aConsultar === 1 ? "cliente será consultado" : "clientes serão consultados"} — {aConsultar} {aConsultar === 1 ? "captcha" : "captchas"}.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setConfirmando(false)}>Voltar</Button>
          <Button data-autofocus variante="primario" carregando={iniciar.isPending} disabled={aConsultar === 0} onClick={comecar}>
            Consultar agora
          </Button>
        </div>
      </Modal>
    </section>
  );
}

function Andamento({ lote, podeCancelar, cancelando, aoCancelar }: { lote: LoteConsulta; podeCancelar: boolean; cancelando: boolean; aoCancelar: () => void }) {
  const aFazer = lote.itens.filter((i) => i.situacao !== "JA_CONSULTADO").length;
  const feitos = lote.itens.filter((i) => i.situacao === "OK" || i.situacao === "ERRO").length;
  const rodando = lote.estado === "EM_ANDAMENTO";
  return (
    <div className="border-t border-line px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="font-semibold">
          {ROTULO_DO_ESTADO[lote.estado]} <span className="font-normal text-muted">({rotuloDoMes(lote.competencia)})</span>
        </p>
        {rodando && podeCancelar && (
          <Button pequeno variante="perigo" carregando={cancelando} onClick={aoCancelar}>
            Cancelar consulta
          </Button>
        )}
      </div>
      <div
        role="progressbar"
        aria-label="Andamento da consulta"
        aria-valuemin={0}
        aria-valuemax={aFazer}
        aria-valuenow={feitos}
        aria-valuetext={`${feitos} de ${aFazer} clientes`}
        className="mt-2 h-2 overflow-hidden rounded-full bg-line/50"
      >
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: aFazer === 0 ? "100%" : `${Math.round((feitos / aFazer) * 100)}%` }} />
      </div>
      <p className="mt-1 text-[13px] text-muted">
        {feitos} de {aFazer} clientes{lote.comErro > 0 ? ` · ${lote.comErro} com erro` : ""} · começou {dataHoraBR(lote.iniciadoEm)}
        {lote.terminadoEm ? `, terminou ${dataHoraBR(lote.terminadoEm)}` : ""}
        {lote.automatico ? " (automática)" : ""}
      </p>
      <ul aria-label="Clientes da consulta" className="mt-3 max-h-72 divide-y divide-line/60 overflow-y-auto rounded-ui border border-line">
        {lote.itens.map((i) => (
          <li key={i.clienteId} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2">
            <span className="min-w-0 flex-1 break-words">{i.nome}</span>
            <span className={`text-[13px] font-semibold ${i.situacao === "ERRO" ? "text-crimson" : i.situacao === "OK" ? "text-moss" : "text-muted"}`}>{ROTULO_DA_SITUACAO[i.situacao]}</span>
            {i.mensagem && <span className="basis-full text-[13px] text-muted">{i.mensagem}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
