"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api";
import type { FatorRDoCliente, FatorRLista } from "./types";

/** Os clientes com folha ou receita informada, com o Fator R do mês de apuração (vazio = o mês corrente). */
export function useFatorR(mes: string) {
  return useQuery({
    queryKey: ["fator-r", "lista", mes],
    queryFn: () => api<FatorRLista>(`/fator-r${mes ? `?mes=${mes}` : ""}`),
    placeholderData: keepPreviousData,
  });
}

export function useFatorRDoCliente(clienteId: number | null, mes: string) {
  return useQuery({
    queryKey: ["fator-r", "cliente", clienteId, mes],
    queryFn: () => api<FatorRDoCliente>(`/fator-r/clientes/${clienteId}${mes ? `?mes=${mes}` : ""}`),
    enabled: clienteId !== null,
    placeholderData: keepPreviousData,
  });
}

/** Grava a folha e/ou a receita de um mês do cliente; as duas vazias apagam o mês. */
export function useSalvarMesDoFatorR(clienteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ competencia, folha, receita }: { competencia: string; folha: number | null; receita: number | null }) =>
      api<void>(`/fator-r/clientes/${clienteId}/meses/${competencia}`, { method: "PUT", json: { folha, receita } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fator-r"] }),
  });
}
