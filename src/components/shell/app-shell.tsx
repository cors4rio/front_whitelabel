"use client";

import { List, MagnifyingGlass } from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth";

import { Carregando } from "../ui/spinner";
import { Assinatura } from "./assinatura";
import { Logo } from "./logo";
import { CommandPalette } from "./command-palette";
import { SidebarConteudo } from "./sidebar";

/**
 * Moldura das telas autenticadas: guarda de sessão + navegação.
 *  - Desktop (≥1024px): sidebar fixa de 240px.
 *  - Mobile/tablet: menu recolhido atrás de um hambúrguer; abre como drawer de 85% com overlay e fecha ao
 *    tocar fora, ao escolher um item ou com Esc. Nenhuma tela fica inacessível por causa do menu
 *    (achado #3.1 do legado: o menu cobria a tela inteira e não fechava).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { estado } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);

  useEffect(() => {
    if (estado.status === "anonimo") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [estado.status, pathname, router]);

  // Ctrl/⌘+K abre a palette de qualquer tela.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBuscaAberta((aberta) => !aberta);
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  // Drawer: Esc fecha e a página atrás não rola enquanto ele está aberto.
  useEffect(() => {
    if (!menuAberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setMenuAberto(false);
    window.addEventListener("keydown", aoTeclar);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = "";
    };
  }, [menuAberto]);

  if (estado.status !== "autenticado") {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Carregando texto="Entrando…" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-sidebar lg:block">
        <SidebarConteudo onAbrirBusca={() => setBuscaAberta(true)} />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-bg/90 px-2 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMenuAberto(true)}
          aria-label="Abrir menu"
          aria-expanded={menuAberto}
          aria-controls="menu-mobile"
          className="grid size-11 place-items-center rounded-ui hover:bg-line/40"
        >
          <List size={24} weight="bold" aria-hidden />
        </button>
        <span className="flex min-w-0 flex-1 items-center truncate font-display text-lg font-semibold">
          <Logo fundo="tema" />
        </span>
        <button
          type="button"
          onClick={() => setBuscaAberta(true)}
          aria-label="Buscar"
          className="grid size-11 place-items-center rounded-ui hover:bg-line/40"
        >
          <MagnifyingGlass size={22} weight="bold" aria-hidden />
        </button>
      </header>

      <div className={`fixed inset-0 z-40 lg:hidden ${menuAberto ? "" : "pointer-events-none"}`} inert={!menuAberto}>
        <button
          type="button"
          aria-label="Fechar menu"
          tabIndex={menuAberto ? 0 : -1}
          onClick={() => setMenuAberto(false)}
          className={`absolute inset-0 bg-overlay transition-opacity duration-200 ${menuAberto ? "opacity-100" : "opacity-0"}`}
        />
        <div
          id="menu-mobile"
          role="dialog"
          aria-modal="true"
          aria-label="Menu principal"
          className={`absolute inset-y-0 left-0 w-[85%] max-w-[320px] bg-sidebar transition-transform duration-200 ${
            menuAberto ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarConteudo
            onNavegar={() => setMenuAberto(false)}
            onAbrirBusca={() => {
              setMenuAberto(false);
              setBuscaAberta(true);
            }}
          />
        </div>
      </div>

      <div className="flex min-h-dvh flex-col lg:pl-60">
        <main id="conteudo" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="px-4 pb-6 sm:px-6 lg:px-8">
          <Assinatura />
        </footer>
      </div>

      <CommandPalette aberto={buscaAberta} onMudar={setBuscaAberta} />
    </div>
  );
}
