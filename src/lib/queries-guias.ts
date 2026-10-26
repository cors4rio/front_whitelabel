"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api";
import type { EstimativaDoAtraso, FiltroSituacao, Guia, GuiaInput, Pagina, SelicDoMes } from "./types";

export const TAMANHO_PAGINA_GUIAS = 20;

export interface FiltrosGuias {
  busca: string;
  situacao: FiltroSituacao;
  clienteId: string;
  pagina: number;
}

/** O que mais se faz com guias é ver o que ainda falta pagar, por isso "em aberto" é o padrão. */
export const FILTROS_GUIAS_PADRAO: FiltrosGuias = { busca: "", situacao: "EM_ABERTO", clienteId: "", pagina: 0 };

function queryString(filtros: FiltrosGuias, tamanho = TAMANHO_PAGINA_GUIAS): string {
  const p = new URLSearchParams({ page: String(filtros.pagina), size: String(tamanho) });
  if (filtros.busca.trim()) p.set("busca", filtros.busca.trim());
  if (filtros.situacao !== "TODAS") p.set("situacao", filtros.situacao);
  if (filtros.clienteId) p.set("clienteId", filtros.clienteId);
  return p.toString();
}

export function useGuias(filtros: FiltrosGuias) {
  return useQuery({
    queryKey: ["guias", "lista", filtros],
    queryFn: () => api<Pagina<Guia>>(`/guias?${queryString(filtros)}`),
    placeholderData: keepPreviousData,
  });
}

export function useGuia(id: number | null) {
  return useQuery({
    queryKey: ["guias", "detalhe", id],
    queryFn: () => api<Guia>(`/guias/${id}`),
    enabled: id !== null,
  });
}

/** As guias em aberto de um cliente (as mais urgentes primeiro), para o detalhe do cliente. */
export function useGuiasEmAbertoDoCliente(clienteId: number) {
  return useQuery({
    queryKey: ["guias", "cliente", clienteId],
    queryFn: () => api<Pagina<Guia>>(`/guias?clienteId=${clienteId}&situacao=EM_ABERTO&size=5`),
  });
}

/** Quanto custaria pagar a guia vencida em `pagamento` (AAAA-MM-DD; vazio = hoje). Estimativa; não gera nada. */
export function useEstimativaDaGuia(id: number, pagamento: string, habilitado: boolean) {
  return useQuery({
    queryKey: ["guias", "estimativa", id, pagamento],
    queryFn: () => api<EstimativaDoAtraso>(`/guias/${id}/estimativa${pagamento ? `?pagamento=${pagamento}` : ""}`),
    enabled: habilitado,
    placeholderData: keepPreviousData,
  });
}

/** A tabela da Selic mensal que entra nos juros da estimativa (os meses mais recentes primeiro). */
export function useSelic(ultimos = 12) {
  return useQuery({ queryKey: ["selic", ultimos], queryFn: () => api<SelicDoMes[]>(`/selic?ultimos=${ultimos}`) });
}

function useAtualizarEstimativas() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["selic"] });
    qc.invalidateQueries({ queryKey: ["guias", "estimativa"] });
    qc.invalidateQueries({ queryKey: ["financeiro"] });
  };
}

/** Digita (ou corrige) a Selic de um mês fechado, em %. Só ADMIN. */
export function useDefinirSelic() {
  const atualizar = useAtualizarEstimativas();
  return useMutation({
    mutationFn: ({ competencia, taxa }: { competencia: string; taxa: number }) =>
      api<SelicDoMes>(`/selic/${competencia}`, { method: "PUT", json: { taxa } }),
    onSuccess: atualizar,
  });
}

/** Busca no Banco Central os meses fechados que faltam. Só ADMIN. */
export function useBuscarSelicNoBanco() {
  const atualizar = useAtualizarEstimativas();
  return useMutation({ mutationFn: () => api<{ novos: number }>("/selic/atualizar", { method: "POST" }), onSuccess: atualizar });
}

/** Qualquer mudança em guia pode alterar listas, o detalhe do cliente e os números do Painel. */
function useAtualizarTelas() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["guias"] });
    qc.invalidateQueries({ queryKey: ["resumo"] });
  };
}

/** Cria (id null) ou atualiza. Os dados da guia; o estado só muda pelas ações de {@link useAcoesDaGuia}. */
export function useSalvarGuia(id: number | null) {
  const atualizarTelas = useAtualizarTelas();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: GuiaInput) =>
      id === null
        ? api<Guia>("/guias", { method: "POST", json: dados })
        : api<Guia>(`/guias/${id}`, { method: "PUT", json: dados }),
    onSuccess: (guia) => {
      qc.setQueryData(["guias", "detalhe", guia.id], guia);
      atualizarTelas();
    },
  });
}

/** Anexa o PDF a uma guia recém-criada (ou o substitui). Separado do salvar: a criação é JSON, o envio é multipart. */
export function useEnviarArquivoDaGuia() {
  const atualizarTelas = useAtualizarTelas();
  return useMutation({
    mutationFn: ({ id, arquivo }: { id: number; arquivo: File }) => enviar(`/guias/${id}/arquivo`, "arquivo", arquivo),
    onSuccess: atualizarTelas,
  });
}

/** Ações sobre uma guia existente. Cada uma devolve a guia já atualizada, que vira o cache do detalhe. */
export function useAcoesDaGuia(id: number) {
  const atualizarTelas = useAtualizarTelas();
  const qc = useQueryClient();
  const aoSucesso = (guia: Guia) => {
    qc.setQueryData(["guias", "detalhe", id], guia);
    atualizarTelas();
  };

  return {
    marcarPaga: useMutation({
      mutationFn: ({ data, comprovante }: { data: string | null; comprovante: File | null }) => {
        const corpo = new FormData();
        if (data) corpo.set("dataPagamento", data);
        if (comprovante) corpo.set("comprovante", comprovante);
        return api<Guia>(`/guias/${id}/marcar-paga`, { method: "POST", body: corpo });
      },
      onSuccess: aoSucesso,
    }),
    cancelar: useMutation({ mutationFn: () => api<Guia>(`/guias/${id}/cancelar`, { method: "POST" }), onSuccess: aoSucesso }),
    reabrir: useMutation({ mutationFn: () => api<Guia>(`/guias/${id}/reabrir`, { method: "POST" }), onSuccess: aoSucesso }),
    remover: useMutation({ mutationFn: () => api<void>(`/guias/${id}`, { method: "DELETE" }), onSuccess: atualizarTelas }),
    anexarArquivo: useMutation({
      mutationFn: (arquivo: File) => enviar(`/guias/${id}/arquivo`, "arquivo", arquivo),
      onSuccess: aoSucesso,
    }),
    removerArquivo: useMutation({
      mutationFn: () => api<Guia>(`/guias/${id}/arquivo`, { method: "DELETE" }),
      onSuccess: aoSucesso,
    }),
    anexarComprovante: useMutation({
      mutationFn: (arquivo: File) => enviar(`/guias/${id}/comprovante`, "comprovante", arquivo),
      onSuccess: aoSucesso,
    }),
    removerComprovante: useMutation({
      mutationFn: () => api<Guia>(`/guias/${id}/comprovante`, { method: "DELETE" }),
      onSuccess: aoSucesso,
    }),
  };
}

function enviar(caminho: string, campo: string, arquivo: File): Promise<Guia> {
  const corpo = new FormData();
  corpo.set(campo, arquivo);
  return api<Guia>(caminho, { method: "PUT", body: corpo });
}
