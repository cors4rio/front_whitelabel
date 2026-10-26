"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ApiError } from "@/lib/api";
import { AuthProvider } from "@/lib/auth";

import { ToastProvider } from "./ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Erro 4xx não melhora repetindo; só vale tentar de novo em falha de rede/servidor.
            retry: (tentativas, erro) => (erro instanceof ApiError && erro.status >= 400 && erro.status < 500 ? false : tentativas < 2),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
