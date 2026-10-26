"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shell/logo";
import { Field, Input } from "@/components/ui/field";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Só aceita caminhos internos como destino pós-login (evita open redirect via ?next=//site-malicioso). */
function destinoSeguro(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/painel";
}

// Sem a assinatura Auttopus de propósito: login não leva o rodapé (docs/ui-ux.md, seção 13).
export function FormLogin() {
  const { estado, entrar } = useAuth();
  const router = useRouter();
  const destino = destinoSeguro(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (estado.status === "autenticado") router.replace(destino);
  }, [estado.status, destino, router]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
      router.replace(destino);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.");
      setEnviando(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <p className="font-display text-2xl font-semibold">
          <Logo fundo="tema" />
        </p>
        <h1 className="mt-6 font-display text-[32px] font-semibold leading-tight">Entre na sua conta</h1>

        <form onSubmit={enviar} className="mt-6 flex flex-col gap-4 rounded-ui border border-line bg-paper p-6" noValidate>
          <Field rotulo="E-mail">
            {(a) => (
              <Input
                {...a}
                type="email"
                autoComplete="username"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <Field rotulo="Senha">
            {(a) => (
              <div className="relative">
                <Input
                  {...a}
                  type={mostrarSenha ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className="pr-11"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-1 top-1 grid size-8 place-items-center rounded-ui text-muted hover:bg-line/40"
                >
                  {mostrarSenha ? <EyeSlash size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                </button>
              </div>
            )}
          </Field>

          {erro && (
            <p role="alert" className="rounded-ui border border-crimson/40 px-3 py-2 text-[13px] text-crimson">
              {erro}
            </p>
          )}

          <Button type="submit" variante="primario" carregando={enviando} disabled={!email || !senha} className="mt-1 w-full">
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}
