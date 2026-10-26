import type { Metadata } from "next";
import { Suspense } from "react";

import { Carregando } from "@/components/ui/spinner";

import { GuiasView } from "./guias-view";

export const metadata: Metadata = { title: "Guias" };

export default function PaginaGuias() {
  return (
    // useSearchParams (id/novo/filtros na URL) exige um limite de Suspense acima do componente.
    <Suspense fallback={<Carregando texto="Carregando guias…" />}>
      <GuiasView />
    </Suspense>
  );
}
