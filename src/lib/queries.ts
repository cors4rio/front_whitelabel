"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api";
import type {
  Cliente,
  ClienteInput,
  Pagina,
  Plano,
  ResultadoImportacao,
  ResumoPainel,
  StatusCliente,
} from "./types";

export const TAMANHO_PAGINA = 20;

export interface FiltrosClientes {
  busca: string;
  status: StatusCliente | "";
  planoId: string;
  semPlano: boolean;
  pagina: number;
}

export const FILTROS_VAZIOS: FiltrosClientes = { busca: "", status: "", planoId: "", semPlano: false, pagina: 0 };

function queryString(filtros: FiltrosClientes): string {
  const p = new URLSearchParams({ page: String(filtros.pagina), size: String(TAMANHO_PAGINA) });
  if (filtros.busca.trim()) p.set("busca", filtros.busca.trim());
  if (filtros.status) p.set("status", filtros.status);
  if (filtros.planoId) p.set("planoId", filtros.planoId);
  if (filtros.semPlano) p.set("semPlano", "true");
  return p.toString();
}

export function useClientes(filtros: FiltrosClientes) {
  return useQuery({
    queryKey: ["clientes", "lista", filtros],
    queryFn: () => api<Pagina<Cliente>>(`/clientes?${queryString(filtros)}`),
    placeholderData: keepPreviousData,
  });
}

export function useCliente(id: number | null) {
  return useQuery({
    queryKey: ["clientes", "detalhe", id],
    queryFn: () => api<Cliente>(`/clientes/${id}`),
    enabled: id !== null,
  });
}

export function usePlanos() {
  return useQuery({ queryKey: ["planos"], queryFn: () => api<Plano[]>("/planos") });
}

export function useResumo() {
  return useQuery({ queryKey: ["resumo"], queryFn: () => api<ResumoPainel>("/dashboard/resumo") });
}

/** Cria (sem id) ou atualiza (com id). Invalida listas e o resumo do Painel, que dependem desses dados. */
export function useSalvarCliente(id: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: ClienteInput) =>
      id === null
        ? api<Cliente>("/clientes", { method: "POST", json: dados })
        : api<Cliente>(`/clientes/${id}`, { method: "PUT", json: dados }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["resumo"] });
    },
  });
}

export function useRemoverCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/clientes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["resumo"] });
    },
  });
}

export function useImportarClientes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ arquivo, simular }: { arquivo: File; simular: boolean }) => {
      const corpo = new FormData();
      corpo.set("arquivo", arquivo);
      return api<ResultadoImportacao>(`/clientes/importar?simular=${simular}`, { method: "POST", body: corpo });
    },
    onSuccess: (resultado) => {
      if (!resultado.simulacao) {
        qc.invalidateQueries({ queryKey: ["clientes"] });
        qc.invalidateQueries({ queryKey: ["resumo"] });
      }
    },
  });
}

export interface PlanoInput {
  nome: string;
  valor: number;
  descricao: string | null;
  ativo: boolean;
}

export function useSalvarPlano(id: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: PlanoInput) =>
      id === null
        ? api<Plano>("/planos", { method: "POST", json: dados })
        : api<Plano>(`/planos/${id}`, { method: "PUT", json: dados }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planos"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["resumo"] });
    },
  });
}
