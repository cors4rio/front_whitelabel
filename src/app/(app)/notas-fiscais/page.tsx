import type { Metadata } from "next";
import { Suspense } from "react";

import { Carregando } from "@/components/ui/spinner";

import { NotasView } from "./notas-view";

export const metadata: Metadata = { title: "Notas fiscais" };

export default function PaginaNotasFiscais() {
  return (
    // useSearchParams (id/novo/filtros na URL) exige um limite de Suspense acima do componente.
    <Suspense fallback={<Carregando texto="Carregando notas fiscais…" />}>
      <NotasView />
    </Suspense>
  );
}
