"use client";

import { useEffect, useState } from "react";

/** Valor com atraso: só muda depois de {@code ms} sem novas alterações. Evita uma requisição por tecla digitada. */
export function useAtrasado<T>(valor: T, ms: number): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}
