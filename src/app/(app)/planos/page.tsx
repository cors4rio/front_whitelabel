import type { Metadata } from "next";

import { PlanosView } from "./planos-view";

export const metadata: Metadata = { title: "Planos" };

export default function PaginaPlanos() {
  return <PlanosView />;
}
