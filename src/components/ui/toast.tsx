"use client";

import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Tipo = "sucesso" | "erro";
interface Aviso {
  id: number;
  tipo: Tipo;
  texto: string;
}

interface ToastApi {
  sucesso: (texto: string) => void;
  erro: (texto: string) => void;
}

const Contexto = createContext<ToastApi | null>(null);
let proximoId = 1;

/** Confirmações no passado ("Cliente salvo"), erros com o que fazer. Some sozinho; leitores de tela anunciam. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const adicionar = useCallback((tipo: Tipo, texto: string) => {
    const id = proximoId++;
    setAvisos((atual) => [...atual, { id, tipo, texto }]);
    setTimeout(() => setAvisos((atual) => atual.filter((a) => a.id !== id)), tipo === "erro" ? 7000 : 4000);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ sucesso: (t) => adicionar("sucesso", t), erro: (t) => adicionar("erro", t) }),
    [adicionar],
  );

  return (
    <Contexto.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {avisos.map((a) => (
          <div
            key={a.id}
            className="pointer-events-auto flex max-w-md items-start gap-2 rounded-ui border border-line bg-paper px-4 py-3 text-sm shadow-[0_8px_24px_rgba(36,28,26,0.12)]"
          >
            {a.tipo === "sucesso" ? (
              <CheckCircle size={20} weight="bold" className="mt-0.5 shrink-0 text-moss" aria-hidden />
            ) : (
              <WarningCircle size={20} weight="bold" className="mt-0.5 shrink-0 text-crimson" aria-hidden />
            )}
            <span>{a.texto}</span>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export function useToast(): ToastApi {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return contexto;
}
