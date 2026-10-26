"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import type {
  CanalEmissao,
  CancelamentoInput,
  ConfiguracaoFiscal,
  FiltroPerfil,
  Financeiro,
  FiltroStatusNota,
  LoteConsulta,
  MovimentoPortal,
  NotaFiscal,
  NotaFiscalInput,
  NotaFiscalResumo,
  Pagina,
  PerfilFiscal,
  PerfilFiscalInput,
  PerfilFiscalResumo,
  PortalInput,
  ResultadoTesteConexao,
  Tomador,
  TomadorInput,
} from "../types";
import { apiNotas } from "./cliente-api";

export const TAMANHO_PAGINA_NOTAS = 20;

export interface FiltrosNotas {
  busca: string;
  situacao: FiltroStatusNota;
  clienteId: string;
  /** AAAA-MM da competência; vazio = qualquer mês. */
  mes: string;
  pagina: number;
}

/** O histórico completo, mais recentes primeiro: é nele que se procura uma nota emitida, e o que pede atenção vem à vista. */
export const FILTROS_NOTAS_PADRAO: FiltrosNotas = { busca: "", situacao: "TODAS", clienteId: "", mes: "", pagina: 0 };

function queryString(filtros: FiltrosNotas, tamanho = TAMANHO_PAGINA_NOTAS): string {
  const p = new URLSearchParams({ page: String(filtros.pagina), size: String(tamanho) });
  if (filtros.busca.trim()) p.set("busca", filtros.busca.trim());
  if (filtros.situacao !== "TODAS") p.set("situacao", filtros.situacao);
  if (filtros.clienteId) p.set("clienteId", filtros.clienteId);
  if (filtros.mes) p.set("mes", filtros.mes);
  return p.toString();
}

/** Enquanto o sistema nacional não respondeu, a tela pergunta de novo sozinha. */
const INTERVALO_ENQUANTO_ENVIADA_MS = 2000;

export function useNotas(filtros: FiltrosNotas) {
  return useQuery({
    queryKey: ["notas", "lista", filtros],
    queryFn: () => apiNotas<Pagina<NotaFiscalResumo>>(`/notas-fiscais?${queryString(filtros)}`),
    placeholderData: keepPreviousData,
    refetchInterval: (consulta) =>
      consulta.state.data?.content.some((n) => n.status === "ENVIADA") ? INTERVALO_ENQUANTO_ENVIADA_MS : false,
  });
}

export function useNota(id: number | null) {
  return useQuery({
    queryKey: ["notas", "detalhe", id],
    queryFn: () => apiNotas<NotaFiscal>(`/notas-fiscais/${id}`),
    enabled: id !== null,
    refetchInterval: (consulta) => (consulta.state.data?.status === "ENVIADA" ? INTERVALO_ENQUANTO_ENVIADA_MS : false),
  });
}

/** As últimas notas emitidas em nome de um cliente, para o detalhe dele. */
export function useNotasDoCliente(clienteId: number) {
  return useQuery({
    queryKey: ["notas", "cliente", clienteId],
    queryFn: () => apiNotas<Pagina<NotaFiscalResumo>>(`/notas-fiscais?clienteId=${clienteId}&size=5`),
  });
}

/** Busca rápida da command palette. */
export function useBuscaDeNotas(termo: string, habilitado: boolean) {
  return useQuery({
    queryKey: ["notas", "palette", termo],
    queryFn: () => apiNotas<Pagina<NotaFiscalResumo>>(`/notas-fiscais?busca=${encodeURIComponent(termo)}&size=4`),
    enabled: habilitado,
  });
}

/** Qualquer mudança numa nota pode alterar a lista, o detalhe do cliente e (no futuro) os números do Painel. */
function useAtualizarTelas() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["notas"] });
  };
}

/** Cria (id null) ou atualiza os dados de um rascunho ou de uma nota rejeitada. */
export function useSalvarNota(id: number | null) {
  const atualizarTelas = useAtualizarTelas();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: NotaFiscalInput) =>
      id === null
        ? apiNotas<NotaFiscal>("/notas-fiscais", { method: "POST", json: dados })
        : apiNotas<NotaFiscal>(`/notas-fiscais/${id}`, { method: "PUT", json: dados }),
    onSuccess: (nota) => {
      qc.setQueryData(["notas", "detalhe", nota.id], nota);
      atualizarTelas();
    },
  });
}

export function useEmitirNota() {
  const atualizarTelas = useAtualizarTelas();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiNotas<NotaFiscal>(`/notas-fiscais/${id}/emitir`, { method: "POST" }),
    onSuccess: (nota) => {
      qc.setQueryData(["notas", "detalhe", nota.id], nota);
      atualizarTelas();
      // Emitir consome um número de DPS: o perfil do cliente mostra o próximo.
      qc.invalidateQueries({ queryKey: ["perfis"] });
    },
  });
}

export function useCancelarNota(id: number) {
  const atualizarTelas = useAtualizarTelas();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: CancelamentoInput) => apiNotas<NotaFiscal>(`/notas-fiscais/${id}/cancelar`, { method: "POST", json: dados }),
    onSuccess: (nota) => {
      qc.setQueryData(["notas", "detalhe", nota.id], nota);
      atualizarTelas();
    },
  });
}

export function useExcluirNota() {
  const atualizarTelas = useAtualizarTelas();
  return useMutation({
    mutationFn: (id: number) => apiNotas<void>(`/notas-fiscais/${id}`, { method: "DELETE" }),
    onSuccess: atualizarTelas,
  });
}

// ── Configuração do escritório (ambiente) ─────────────────────────────────────────────────────

export function useConfiguracaoFiscal() {
  return useQuery({
    queryKey: ["notas", "configuracao"],
    queryFn: () => apiNotas<ConfiguracaoFiscal>("/configuracao-fiscal"),
  });
}

export function useSalvarConfiguracao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: ConfiguracaoFiscal) => apiNotas<ConfiguracaoFiscal>("/configuracao-fiscal", { method: "PUT", json: dados }),
    onSuccess: (configuracao) => {
      qc.setQueryData(["notas", "configuracao"], configuracao);
      qc.invalidateQueries({ queryKey: ["perfis"] }); // trocar de ambiente pede novo teste de conexão em cada cliente
    },
  });
}

// ── Dados fiscais por cliente ─────────────────────────────────────────────────────────────────

export interface FiltrosPerfis {
  busca: string;
  situacao: FiltroPerfil;
  pagina: number;
}

export const FILTROS_PERFIS_PADRAO: FiltrosPerfis = { busca: "", situacao: "TODOS", pagina: 0 };
export const TAMANHO_PAGINA_PERFIS = 20;

export function usePerfis(filtros: FiltrosPerfis) {
  return useQuery({
    queryKey: ["perfis", "lista", filtros],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(filtros.pagina), size: String(TAMANHO_PAGINA_PERFIS) });
      if (filtros.busca.trim()) p.set("busca", filtros.busca.trim());
      if (filtros.situacao !== "TODOS") p.set("situacao", filtros.situacao);
      return apiNotas<Pagina<PerfilFiscalResumo>>(`/perfis-fiscais?${p}`);
    },
    placeholderData: keepPreviousData,
  });
}

export function usePerfil(clienteId: number | null) {
  return useQuery({
    queryKey: ["perfis", "detalhe", clienteId],
    queryFn: () => apiNotas<PerfilFiscal>(`/perfis-fiscais/${clienteId}`),
    enabled: clienteId !== null,
  });
}

const CHAVE_DO_TESTE = ["perfis", "teste"] as const;
const CANAIS: CanalEmissao[] = ["NACIONAL", "MUNICIPAL_SALVADOR"];

/** Mudou algo do perfil: guarda o novo, atualiza a lista e apaga o resultado do último teste de conexão. */
function useGuardarPerfil() {
  const qc = useQueryClient();
  return (perfil: PerfilFiscal) => {
    qc.setQueryData(["perfis", "detalhe", perfil.clienteId], perfil);
    for (const canal of CANAIS) qc.setQueryData([...CHAVE_DO_TESTE, perfil.clienteId, canal], null);
    qc.invalidateQueries({ queryKey: ["perfis", "lista"] });
  };
}

export function useSalvarPerfil(clienteId: number) {
  const guardar = useGuardarPerfil();
  return useMutation({
    mutationFn: (dados: PerfilFiscalInput) => apiNotas<PerfilFiscal>(`/perfis-fiscais/${clienteId}`, { method: "PUT", json: dados }),
    onSuccess: guardar,
  });
}

/** O arquivo e a senha seguem no corpo da requisição e nunca ficam em estado do React depois do envio. */
export function useEnviarCertificado(clienteId: number) {
  const guardar = useGuardarPerfil();
  return useMutation({
    gcTime: 0, // as variáveis da mutação (a senha) não podem ficar no cache depois de usadas
    mutationFn: ({ arquivo, senha }: { arquivo: File; senha: string }) => {
      const corpo = new FormData();
      corpo.set("arquivo", arquivo);
      corpo.set("senha", senha);
      return apiNotas<PerfilFiscal>(`/perfis-fiscais/${clienteId}/certificado`, { method: "PUT", body: corpo });
    },
    onSuccess: guardar,
  });
}

export function useSalvarPortal(clienteId: number) {
  const guardar = useGuardarPerfil();
  return useMutation({
    gcTime: 0, // idem: a senha do portal não fica no cache
    mutationFn: (dados: PortalInput) => apiNotas<PerfilFiscal>(`/perfis-fiscais/${clienteId}/portal`, { method: "PUT", json: dados }),
    onSuccess: guardar,
  });
}

export function useRemoverCredencial(clienteId: number, qual: "certificado" | "portal") {
  const guardar = useGuardarPerfil();
  return useMutation({
    mutationFn: () => apiNotas<PerfilFiscal>(`/perfis-fiscais/${clienteId}/${qual}`, { method: "DELETE" }),
    onSuccess: guardar,
  });
}

export function useTestarConexao(clienteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (canal: CanalEmissao) => apiNotas<ResultadoTesteConexao>(`/perfis-fiscais/${clienteId}/testar-conexao?canal=${canal}`, { method: "POST" }),
    onSuccess: (resultado, canal) => {
      qc.setQueryData([...CHAVE_DO_TESTE, clienteId, canal], resultado);
      // O teste pode marcar a conexão como testada: a lista de pré-requisitos precisa refletir isso.
      qc.invalidateQueries({ queryKey: ["perfis", "detalhe", clienteId] });
      qc.invalidateQueries({ queryKey: ["perfis", "lista"] });
    },
  });
}

/** O resultado do último teste de conexão deste canal do cliente (null se não houve, ou se o perfil mudou depois). */
export function useResultadoDoTeste(clienteId: number, canal: CanalEmissao): ResultadoTesteConexao | null {
  const { data } = useQuery<ResultadoTesteConexao | null>({
    queryKey: [...CHAVE_DO_TESTE, clienteId, canal],
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
  });
  return data ?? null;
}

// ── Movimento no portal de Salvador (só leitura) ──────────────────────────────────────────────

/** As últimas competências já consultadas no portal para este cliente (a mais recente primeiro). */
export function useMovimentosDoPortal(clienteId: number, habilitado: boolean) {
  return useQuery({
    queryKey: ["perfis", "movimentos", clienteId],
    queryFn: () => apiNotas<MovimentoPortal[]>(`/perfis-fiscais/${clienteId}/movimentos-portal`),
    enabled: habilitado,
  });
}

/** Entra no portal com o login do cliente (um captcha; pode levar uns dois minutos) e lê a competência. Nunca emite nada. */
export function useConsultarPortal(clienteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (competencia: string) => apiNotas<MovimentoPortal>(`/perfis-fiscais/${clienteId}/movimentos-portal`, { method: "POST", json: { competencia } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["perfis", "movimentos", clienteId] });
      qc.invalidateQueries({ queryKey: ["guias"] }); // a guia lida do portal entra no módulo de Guias
      qc.invalidateQueries({ queryKey: ["resumo"] });
    },
  });
}

// ── Financeiro e consulta em lote ─────────────────────────────────────────────────────────────

/** Guias em valor e o que os clientes emitiram (lido do portal), num mês AAAA-MM (vazio = o mês corrente). */
export function useFinanceiro(mes: string) {
  return useQuery({
    queryKey: ["financeiro", mes],
    queryFn: () => apiNotas<Financeiro>(`/financeiro${mes ? `?mes=${mes}` : ""}`),
    placeholderData: keepPreviousData,
  });
}

const INTERVALO_DO_LOTE_MS = 2000;

/** O lote em andamento ou o último que terminou (null se nunca houve). Enquanto anda, a tela pergunta de novo sozinha. */
export function useLoteAtual() {
  return useQuery({
    queryKey: ["financeiro", "lote"],
    queryFn: async () => (await apiNotas<LoteConsulta | undefined>("/movimentos-portal/lote")) ?? null,
    refetchInterval: (consulta) => (consulta.state.data?.estado === "EM_ANDAMENTO" ? INTERVALO_DO_LOTE_MS : false),
  });
}

export function useIniciarLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: { competencia: string; somenteFaltantes: boolean }) =>
      apiNotas<LoteConsulta>("/movimentos-portal/lote", { method: "POST", json: dados }),
    onSuccess: (lote) => qc.setQueryData(["financeiro", "lote"], lote),
  });
}

export function useCancelarLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiNotas<LoteConsulta>("/movimentos-portal/lote/cancelar", { method: "POST" }),
    onSuccess: (lote) => qc.setQueryData(["financeiro", "lote"], lote),
  });
}

/** Quando o lote termina, o que ele leu aparece no financeiro, nas guias e no painel (uma vez por lote). */
export function useAoTerminarOLote(lote: LoteConsulta | null | undefined) {
  const qc = useQueryClient();
  const terminadoId = lote && lote.estado !== "EM_ANDAMENTO" ? lote.id : null;
  const jaAvisado = useRef<string | null>(null);
  useEffect(() => {
    if (terminadoId === null || jaAvisado.current === terminadoId) return;
    jaAvisado.current = terminadoId;
    qc.invalidateQueries({ queryKey: ["financeiro"] });
    qc.invalidateQueries({ queryKey: ["perfis", "movimentos"] });
    qc.invalidateQueries({ queryKey: ["guias"] });
    qc.invalidateQueries({ queryKey: ["resumo"] });
  }, [terminadoId, qc]);
}

// ── Tomadores ─────────────────────────────────────────────────────────────────────────────────

export function useTomadores(clienteId: number | null, busca = "", tamanho = 8) {
  return useQuery({
    queryKey: ["perfis", "tomadores", clienteId, busca, tamanho],
    queryFn: () => apiNotas<Pagina<Tomador>>(`/perfis-fiscais/${clienteId}/tomadores?busca=${encodeURIComponent(busca)}&size=${tamanho}`),
    enabled: clienteId !== null,
    placeholderData: keepPreviousData,
  });
}

export function useSalvarTomador(clienteId: number, id: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: TomadorInput) =>
      id === null
        ? apiNotas<Tomador>(`/perfis-fiscais/${clienteId}/tomadores`, { method: "POST", json: dados })
        : apiNotas<Tomador>(`/tomadores/${id}`, { method: "PUT", json: dados }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["perfis", "tomadores", clienteId] }),
  });
}

export function useExcluirTomador(clienteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiNotas<void>(`/tomadores/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["perfis", "tomadores", clienteId] }),
  });
}
