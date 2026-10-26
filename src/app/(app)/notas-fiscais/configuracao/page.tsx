import type { Metadata } from "next";
import { Suspense } from "react";

import { ConfiguracaoView } from "./configuracao-view";

export const metadata: Metadata = { title: "Configuração fiscal" };

export default function PaginaConfiguracaoFiscal() {
  // useSearchParams (o cliente aberto, a busca e os filtros estão na URL) pede um limite de Suspense.
  return (
    <Suspense>
      <ConfiguracaoView />
    </Suspense>
  );
}
