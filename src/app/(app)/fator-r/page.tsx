import type { Metadata } from "next";
import { Suspense } from "react";

import { FatorRView } from "./fator-r-view";

export const metadata: Metadata = { title: "Fator R" };

export default function PaginaFatorR() {
  // useSearchParams (o cliente aberto e o mês estão na URL) pede um limite de Suspense.
  return (
    <Suspense>
      <FatorRView />
    </Suspense>
  );
}
