import type { Metadata } from "next";
import { Suspense } from "react";

import { FinanceiroView } from "./financeiro-view";

export const metadata: Metadata = { title: "Financeiro" };

export default function PaginaFinanceiro() {
  // useSearchParams (o mês escolhido está na URL) pede um limite de Suspense.
  return (
    <Suspense>
      <FinanceiroView />
    </Suspense>
  );
}
