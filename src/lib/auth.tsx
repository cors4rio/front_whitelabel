"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, renovarSessao, setAccessToken, setAoPerderSessao } from "./api";
import type { Sessao, Usuario } from "./types";

type Estado =
  | { status: "carregando"; usuario: null }
  | { status: "autenticado"; usuario: Usuario }
  | { status: "anonimo"; usuario: null };

interface AuthContexto {
  estado: Estado;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const Contexto = createContext<AuthContexto | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ status: "carregando", usuario: null });
  const queryClient = useQueryClient();

  // Ao abrir o app, tenta recuperar a sessão pelo cookie de refresh (o access token não sobrevive a um F5).
  useEffect(() => {
    let cancelado = false;
    renovarSessao().then((sessao) => {
      if (cancelado) return;
      setEstado(sessao ? { status: "autenticado", usuario: sessao.usuario } : { status: "anonimo", usuario: null });
    });
    setAoPerderSessao(() => setEstado({ status: "anonimo", usuario: null }));
    return () => {
      cancelado = true;
      setAoPerderSessao(null);
    };
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const sessao = await api<Sessao>("/auth/login", { method: "POST", json: { email, senha } });
    setAccessToken(sessao.accessToken);
    setEstado({ status: "autenticado", usuario: sessao.usuario });
  }, []);

  const sair = useCallback(async () => {
    try {
      await api<void>("/auth/logout", { method: "POST" });
    } finally {
      setAccessToken(null);
      queryClient.clear();
      setEstado({ status: "anonimo", usuario: null });
    }
  }, [queryClient]);

  const valor = useMemo(() => ({ estado, entrar, sair }), [estado, entrar, sair]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): AuthContexto {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return contexto;
}
