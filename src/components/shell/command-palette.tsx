"use client";

import { useQuery } from "@tanstack/react-query";
import { FilePlus, FileText, MagnifyingGlass, Plus, UploadSimple } from "@phosphor-icons/react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api";
import { formatarDocumento } from "@/lib/documento";
import { dataBR, moeda } from "@/lib/format";
import { NOTAS_FISCAIS_ATIVAS } from "@/lib/notas/modo";
import { useBuscaDeNotas } from "@/lib/notas/queries";
import { dataDaLinha, ROTULO_STATUS } from "@/lib/notas/regras";
import type { Cliente, Guia, Pagina } from "@/lib/types";
import { useAtrasado } from "@/lib/use-atrasado";

import { ITENS_NAV } from "./nav";

interface Props {
  aberto: boolean;
  onMudar: (aberto: boolean) => void;
}

const semAcento = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

const ACOES = [
  { rotulo: "Novo cliente", href: "/clientes?novo=1", icone: Plus },
  { rotulo: "Nova guia", href: "/guias?novo=1", icone: FilePlus },
  ...(NOTAS_FISCAIS_ATIVAS ? [{ rotulo: "Emitir nota fiscal", href: "/notas-fiscais?novo=1", icone: FileText }] : []),
  { rotulo: "Importar clientes (CSV)", href: "/clientes?importar=1", icone: UploadSimple },
];

/**
 * Command palette (Ctrl/⌘+K): busca de clientes e guias, ações rápidas e navegação direta. 100% por teclado
 * (↑↓ move, Enter escolhe, Esc fecha). Não substitui a sidebar — é para quem já sabe o que quer.
 */
export function CommandPalette({ aberto, onMudar }: Props) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const termo = useAtrasado(texto.trim(), 200);
  const buscando = aberto && termo.length >= 2;

  const { data: clientes, isFetching: buscandoClientes } = useQuery({
    queryKey: ["palette-clientes", termo],
    queryFn: () => api<Pagina<Cliente>>(`/clientes?busca=${encodeURIComponent(termo)}&size=6`),
    enabled: buscando,
  });
  // Só guias em aberto: é o que se procura no dia a dia, e as pagas/antigas afogariam o resultado.
  const { data: guias, isFetching: buscandoGuias } = useQuery({
    queryKey: ["palette-guias", termo],
    queryFn: () => api<Pagina<Guia>>(`/guias?busca=${encodeURIComponent(termo)}&situacao=EM_ABERTO&size=4`),
    enabled: buscando,
  });

  const { data: notas, isFetching: buscandoNotas } = useBuscaDeNotas(termo, buscando && NOTAS_FISCAIS_ATIVAS);

  function ir(href: string) {
    onMudar(false);
    setTexto("");
    router.push(href);
  }

  const filtro = semAcento(texto);
  const acoes = ACOES.filter((a) => semAcento(a.rotulo).includes(filtro));
  const destinos = ITENS_NAV.filter((i) => semAcento(i.rotulo).includes(filtro));
  const clientesVisiveis = termo.length >= 2 ? (clientes?.content ?? []) : [];
  const guiasVisiveis = termo.length >= 2 ? (guias?.content ?? []) : [];
  const notasVisiveis = termo.length >= 2 && NOTAS_FISCAIS_ATIVAS ? (notas?.content ?? []) : [];
  // "Emitir nota para…" (spec de design, command palette): um atalho por cliente achado, direto para a nota nova dele.
  const emissoes = NOTAS_FISCAIS_ATIVAS ? clientesVisiveis.slice(0, 3) : [];
  const carregando = buscando && (buscandoClientes || buscandoGuias || buscandoNotas);

  return (
    <Command.Dialog
      open={aberto}
      onOpenChange={(valor) => {
        onMudar(valor);
        if (!valor) setTexto("");
      }}
      label="Buscar clientes, ações e telas"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-50 bg-overlay"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(560px,92vw)] -translate-x-1/2 overflow-hidden rounded-ui border border-line bg-paper shadow-[0_8px_24px_rgba(36,28,26,0.12)]"
    >
      <div className="relative">
        <MagnifyingGlass size={20} weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <Command.Input value={texto} onValueChange={setTexto} placeholder="Buscar cliente, guia, ação ou tela…" />
      </div>
      <Command.List>
        {clientesVisiveis.length > 0 && (
          <Command.Group heading="Clientes">
            {clientesVisiveis.map((c) => (
              <Command.Item key={c.id} value={`cliente-${c.id}`} onSelect={() => ir(`/clientes?id=${c.id}`)}>
                <span className="min-w-0 flex-1 truncate font-medium">{c.nomeRazaoSocial}</span>
                <span className="shrink-0 text-xs text-muted tabular-nums">{formatarDocumento(c.cpfCnpj)}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {guiasVisiveis.length > 0 && (
          <Command.Group heading="Guias em aberto">
            {guiasVisiveis.map((g) => (
              <Command.Item key={g.id} value={`guia-${g.id}`} onSelect={() => ir(`/guias?id=${g.id}`)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{g.descricao}</span>
                  <span className="block truncate text-xs text-muted">
                    {g.clienteNome} · vence {dataBR(g.vencimento)}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted">{moeda(g.valor)}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {notasVisiveis.length > 0 && (
          <Command.Group heading="Notas fiscais">
            {notasVisiveis.map((n) => (
              <Command.Item key={n.id} value={`nota-${n.id}`} onSelect={() => ir(`/notas-fiscais?id=${n.id}`)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{n.prestadorNome}</span>
                  <span className="block truncate text-xs text-muted">
                    para {n.tomadorNome} · {dataDaLinha(n)}
                    {n.numero && ` · Nº ${n.numero}`} · {ROTULO_STATUS[n.status]}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted">{moeda(n.valor)}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {(acoes.length > 0 || emissoes.length > 0) && (
          <Command.Group heading="Ações">
            {emissoes.map((c) => (
              <Command.Item key={`emitir-${c.id}`} value={`emitir-nota-${c.id}`} onSelect={() => ir(`/notas-fiscais?novo=1&clienteId=${c.id}`)}>
                <FileText size={18} weight="bold" aria-hidden />
                <span className="min-w-0 truncate">Emitir nota para {c.nomeRazaoSocial}</span>
              </Command.Item>
            ))}
            {acoes.map(({ rotulo, href, icone: Icone }) => (
              <Command.Item key={href} value={rotulo} onSelect={() => ir(href)}>
                <Icone size={18} weight="bold" aria-hidden />
                {rotulo}
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {destinos.length > 0 && (
          <Command.Group heading="Ir para">
            {destinos.map(({ rotulo, href, icone: Icone }) => (
              <Command.Item key={href} value={`ir-${rotulo}`} onSelect={() => ir(href)}>
                <Icone size={18} weight="bold" aria-hidden />
                {rotulo}
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {carregando && <Command.Loading>Buscando…</Command.Loading>}
        {!carregando &&
          clientesVisiveis.length === 0 &&
          guiasVisiveis.length === 0 &&
          notasVisiveis.length === 0 &&
          acoes.length === 0 &&
          destinos.length === 0 && (
          <Command.Empty>Nada encontrado para “{texto}”.</Command.Empty>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
