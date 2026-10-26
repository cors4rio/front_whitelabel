"use client";

import { CaretDown, MagnifyingGlass, SignOut } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, useSyncExternalStore } from "react";

import { useAuth } from "@/lib/auth";
import { Logo } from "./logo";

import { ehGrupo, ENTRADAS_NAV, type GrupoNav, type ItemNav } from "./nav";

/** A plataforma do navegador não muda durante a sessão: não há nada a assinar. */
const semAssinatura = () => () => {};

interface Props {
  /** Chamado ao navegar — o drawer mobile usa para se fechar. */
  onNavegar?: () => void;
  onAbrirBusca: () => void;
}

const itemAtivo = (pathname: string, { href }: ItemNav) => pathname === href || pathname.startsWith(`${href}/`);

/** Conteúdo do menu lateral, compartilhado entre a sidebar fixa (desktop) e o drawer (mobile). */
export function SidebarConteudo({ onNavegar, onAbrirBusca }: Props) {
  const pathname = usePathname();
  const { estado, sair } = useAuth();
  const idBase = useId();
  // O servidor renderiza "Ctrl K"; no navegador o React troca para ⌘ em Mac sem divergência de hidratação.
  const atalho = useSyncExternalStore(
    semAssinatura,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K"),
    () => "Ctrl K",
  );

  // Acordeão (docs/ui-ux.md, seção 5): um grupo aberto por vez. A pessoa abre e fecha pelo cabeçalho; ao chegar numa
  // tela de um grupo (por link, atalho ou palette) esse grupo abre — ajuste de estado derivado durante a renderização.
  const grupoDaRota = ENTRADAS_NAV.find((e): e is GrupoNav => ehGrupo(e) && e.itens.some((i) => itemAtivo(pathname, i)))?.rotulo ?? null;
  const [aberto, setAberto] = useState<string | null>(grupoDaRota);
  const [rotaVista, setRotaVista] = useState(pathname);
  if (pathname !== rotaVista) {
    setRotaVista(pathname);
    if (grupoDaRota) setAberto(grupoDaRota);
  }

  return (
    <div className="flex h-full flex-col text-sidebar-fg">
      <div className="px-5 pb-4 pt-6">
        <Link href="/painel" onClick={onNavegar} className="inline-block">
          <Logo fundo="escuro" className="font-display text-xl font-semibold" />
        </Link>
      </div>

      <nav aria-label="Principal" className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-1">
          {ENTRADAS_NAV.map((entrada) =>
            ehGrupo(entrada) ? (
              <GrupoDoMenu
                key={entrada.rotulo}
                grupo={entrada}
                id={`${idBase}-${entrada.rotulo}`}
                aberto={aberto === entrada.rotulo}
                ativo={entrada.itens.some((i) => itemAtivo(pathname, i))}
                aoAlternar={() => setAberto((atual) => (atual === entrada.rotulo ? null : entrada.rotulo))}
                pathname={pathname}
                onNavegar={onNavegar}
              />
            ) : (
              <li key={entrada.href}>
                <LinkDoMenu item={entrada} ativo={itemAtivo(pathname, entrada)} onNavegar={onNavegar} />
              </li>
            ),
          )}
        </ul>
      </nav>

      <div className="flex flex-col gap-3 px-3 pb-5">
        {/* O atalho é ensinado, não escondido: a palette é o caminho rápido para quem já sabe o que quer. */}
        <button
          type="button"
          onClick={() => {
            onNavegar?.();
            onAbrirBusca();
          }}
          className="flex h-10 items-center gap-2 rounded-ui border border-white/15 px-3 text-sm text-sidebar-muted hover:bg-white/5 hover:text-sidebar-fg"
        >
          <MagnifyingGlass size={18} weight="bold" aria-hidden />
          <span className="flex-1 whitespace-nowrap text-left">Buscar…</span>
          <kbd className="hidden rounded border border-white/20 px-1.5 text-xs lg:inline">{atalho}</kbd>
        </button>

        {estado.usuario && (
          <div className="flex items-center gap-3 border-t border-white/10 px-2 pt-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{estado.usuario.nome}</p>
              <p className="truncate text-xs text-sidebar-muted">
                {estado.usuario.papel === "ADMIN" ? "Administrador" : "Colaborador"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => sair()}
              aria-label="Sair"
              title="Sair"
              className="grid size-9 place-items-center rounded-ui text-sidebar-muted hover:bg-white/5 hover:text-sidebar-fg"
            >
              <SignOut size={20} weight="bold" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LinkDoMenu({ item, ativo, onNavegar, aninhado = false }: { item: ItemNav; ativo: boolean; onNavegar?: () => void; aninhado?: boolean }) {
  const Icone = item.icone;
  return (
    <Link
      href={item.href}
      onClick={onNavegar}
      aria-current={ativo ? "page" : undefined}
      className={`relative flex items-center gap-3 rounded-ui px-3 text-sm font-medium transition-colors ${aninhado ? "h-10" : "h-11"} ${
        ativo ? "bg-accent/15" : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-fg"
      }`}
    >
      {ativo && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" aria-hidden />}
      {!aninhado && <Icone size={20} weight={ativo ? "fill" : "bold"} aria-hidden />}
      {item.rotulo}
    </Link>
  );
}

interface PropsGrupo {
  grupo: GrupoNav;
  id: string;
  aberto: boolean;
  /** Alguma tela do grupo é a atual (mesmo com o grupo recolhido, o cabeçalho avisa onde a pessoa está). */
  ativo: boolean;
  aoAlternar: () => void;
  pathname: string;
  onNavegar?: () => void;
}

function GrupoDoMenu({ grupo, id, aberto, ativo, aoAlternar, pathname, onNavegar }: PropsGrupo) {
  const Icone = grupo.icone;
  return (
    <li>
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={aoAlternar}
        className={`flex h-11 w-full items-center gap-3 rounded-ui px-3 text-sm font-medium transition-colors hover:bg-white/5 ${
          ativo ? "text-sidebar-fg" : "text-sidebar-muted hover:text-sidebar-fg"
        }`}
      >
        <Icone size={20} weight={ativo && !aberto ? "fill" : "bold"} aria-hidden />
        <span className="flex-1 text-left">{grupo.rotulo}</span>
        <CaretDown size={16} weight="bold" className={`transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <ul id={id} hidden={!aberto} className="ml-[22px] mt-1 flex flex-col gap-1 border-l border-white/10 pl-2">
        {grupo.itens.map((item) => (
          <li key={item.href}>
            <LinkDoMenu item={item} ativo={itemAtivo(pathname, item)} onNavegar={onNavegar} aninhado />
          </li>
        ))}
      </ul>
    </li>
  );
}
