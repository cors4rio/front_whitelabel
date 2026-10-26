import { dataHoraBR } from "@/lib/format";
import { rotuloDoEvento, TOM_DO_EVENTO, type Tom } from "@/lib/notas/regras";
import type { EventoNota } from "@/lib/types";

const COR_DO_PONTO: Record<Tom, string> = {
  ok: "bg-moss",
  atencao: "bg-amber",
  problema: "bg-crimson",
  neutro: "bg-muted",
};

const COR_DO_TITULO: Partial<Record<Tom, string>> = { problema: "text-crimson" };

/**
 * Linha do tempo vertical e simples (docs/ui-ux.md, seção 8): o que aconteceu com a nota,
 * do mais antigo para o mais novo, com data, hora e quem agiu. O ponto colorido acompanha o texto, nunca o substitui.
 */
export function LinhaDoTempo({ eventos }: { eventos: EventoNota[] }) {
  return (
    <ol aria-label="Linha do tempo da nota">
      {eventos.map((evento, i) => {
        const tom = TOM_DO_EVENTO[evento.tipo];
        const ultimo = i === eventos.length - 1;
        return (
          <li key={`${evento.tipo}-${evento.em}-${i}`} className="flex gap-3">
            <div className="flex flex-col items-center" aria-hidden>
              <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${COR_DO_PONTO[tom]}`} />
              {!ultimo && <span className="w-px flex-1 bg-line" />}
            </div>
            <div className={`min-w-0 ${ultimo ? "" : "pb-4"}`}>
              <p className={`font-semibold ${COR_DO_TITULO[tom] ?? ""}`}>{rotuloDoEvento(evento)}</p>
              {evento.detalhe && <p className="text-[13px]">{evento.detalhe}</p>}
              <p className="text-[13px] tabular-nums text-muted">
                {dataHoraBR(evento.em)}
                {evento.por && ` · ${evento.por}`}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
