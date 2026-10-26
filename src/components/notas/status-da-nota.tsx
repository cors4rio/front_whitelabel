import { Pill } from "@/components/ui/pill";
import { ROTULO_STATUS, TOM_STATUS } from "@/lib/notas/regras";
import type { StatusNota } from "@/lib/types";

/** A situação da nota como etiqueta: forma + texto, nunca só cor. */
export function StatusDaNota({ status }: { status: StatusNota }) {
  return <Pill tom={TOM_STATUS[status]}>{ROTULO_STATUS[status]}</Pill>;
}
