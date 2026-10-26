import type { Metadata } from "next";
import { Suspense } from "react";

import { Carregando } from "@/components/ui/spinner";

import { ClientesView } from "./clientes-view";

export const metadata: Metadata = { title: "Clientes" };

export default function PaginaClientes() {
  return (
    // useSearchParams (id/novo/importar na URL) exige um limite de Suspense acima do componente.
    <Suspense fallback={<Carregando texto="Carregando clientes…" />}>
      <ClientesView />
    </Suspense>
  );
}
