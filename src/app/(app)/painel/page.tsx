import type { Metadata } from "next";

import { PainelView } from "./painel-view";

export const metadata: Metadata = { title: "Painel" };

export default function PaginaPainel() {
  return <PainelView />;
}
