import { Pill } from "@/components/ui/pill";
import { rotuloDoAnexo } from "@/lib/fator-r";
import type { ResultadoFatorR } from "@/lib/types";

/** Anexo III (28% ou mais) é o que se quer; V é o aviso. Estado = forma + texto, nunca só cor. */
export function PilulaDoAnexo({ resultado }: { resultado: Pick<ResultadoFatorR, "anexo"> }) {
  return <Pill tom={resultado.anexo === "III" ? "ok" : resultado.anexo === "V" ? "atencao" : "neutro"}>{rotuloDoAnexo(resultado.anexo)}</Pill>;
}
