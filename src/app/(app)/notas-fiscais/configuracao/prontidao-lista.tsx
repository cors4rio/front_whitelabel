"use client";

import { CheckCircle, Warning, XCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { useToast } from "@/components/ui/toast";
import { useResultadoDoTeste, useTestarConexao } from "@/lib/notas/queries";
import { ROTULO_CANAL_CURTO } from "@/lib/notas/regras";
import type { CanalDoPerfil, PerfilFiscal, SituacaoProntidao } from "@/lib/types";

const TOM: Record<SituacaoProntidao, "ok" | "atencao" | "problema"> = { OK: "ok", ATENCAO: "atencao", PENDENTE: "problema" };
const ROTULO: Record<SituacaoProntidao, string> = { OK: "Pronto", ATENCAO: "Atenção", PENDENTE: "Pendente" };

function Icone({ situacao }: { situacao: SituacaoProntidao }) {
  if (situacao === "OK") return <CheckCircle size={22} weight="fill" className="text-moss" aria-hidden />;
  if (situacao === "ATENCAO") return <Warning size={22} weight="fill" className="text-amber-ink" aria-hidden />;
  return <XCircle size={22} weight="fill" className="text-crimson" aria-hidden />;
}

/**
 * Os pré-requisitos da emissão de um cliente por UM canal. É a resposta, em um lugar só, para "por que não consigo
 * emitir para este cliente?": cada item diz o que está certo ou o que falta, em texto. O teste de conexão confere o
 * conjunto. Com mais de um canal disponível, cada um aparece com o seu nome e o seu teste.
 */
export function ProntidaoLista({ perfil, canal, podeTestar, comTitulo }: { perfil: PerfilFiscal; canal: CanalDoPerfil; podeTestar: boolean; comTitulo: boolean }) {
  const testar = useTestarConexao(perfil.clienteId);
  const toast = useToast();
  const resultado = useResultadoDoTeste(perfil.clienteId, canal.canal);
  const pendentes = canal.prontidao.filter((i) => i.situacao === "PENDENTE").length;
  const nome = ROTULO_CANAL_CURTO[canal.canal];

  async function executarTeste() {
    try {
      const r = await testar.mutateAsync(canal.canal);
      if (r.ok) toast.sucesso("Conexão confirmada");
      else toast.erro("O teste encontrou um problema. Veja os detalhes abaixo.");
    } catch (erro) {
      toast.erro(erro instanceof Error ? erro.message : "Não foi possível testar a conexão.");
    }
  }

  return (
    <div role="group" aria-label={comTitulo ? `Canal ${nome}` : undefined} className={comTitulo ? "rounded-ui border border-line p-3.5" : undefined}>
      {comTitulo && (
        <p className="mb-2 flex flex-wrap items-center gap-2 font-semibold">
          Canal {nome}
          <Pill tom={canal.pronta ? "ok" : "problema"}>{canal.pronta ? "Pronto" : "Pendente"}</Pill>
        </p>
      )}
      <p className={`font-medium ${canal.pronta ? "text-moss" : "text-crimson"}`} role="status">
        {canal.pronta
          ? comTitulo
            ? `Pronto para emitir pelo canal ${nome.toLowerCase()}.`
            : "Este cliente está pronto para emitir."
          : `Falta resolver ${pendentes} ${pendentes === 1 ? "item" : "itens"} antes de emitir${comTitulo ? ` pelo canal ${nome.toLowerCase()}` : " para este cliente"}.`}
      </p>

      <ul className="mt-3 divide-y divide-line rounded-ui border border-line">
        {canal.prontidao.map((item) => (
          <li key={item.id} className="flex items-start gap-3 px-3 py-3">
            <span className="mt-0.5 shrink-0">
              <Icone situacao={item.situacao} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{item.titulo}</p>
              <p className="text-[13px] text-muted">{item.detalhe}</p>
            </div>
            <Pill tom={TOM[item.situacao]}>{ROTULO[item.situacao]}</Pill>
          </li>
        ))}
      </ul>

      {podeTestar && perfil.configurado && (
        <div className="mt-4">
          <Button carregando={testar.isPending && testar.variables === canal.canal} onClick={executarTeste}>
            {comTitulo ? `Testar conexão (${nome})` : "Testar conexão deste cliente"}
          </Button>
          <p className="mt-1.5 text-[13px] text-muted">Confere o acesso e o município, sem emitir nada.</p>
        </div>
      )}

      {resultado && (
        <div className="mt-4" role="region" aria-label={comTitulo ? `Resultado do teste de conexão (${nome})` : "Resultado do teste de conexão"}>
          <p className={`font-medium ${resultado.ok ? "text-moss" : "text-crimson"}`}>{resultado.ok ? "A conexão está funcionando." : "O teste não passou."}</p>
          <ol className="mt-2 flex flex-col gap-2">
            {resultado.etapas.map((etapa) => (
              <li key={etapa.titulo} className="flex items-start gap-2 text-[13px]">
                <span className="mt-0.5 shrink-0">
                  <Icone situacao={etapa.ok ? "OK" : "PENDENTE"} />
                </span>
                <span>
                  <strong>{etapa.titulo}.</strong> {etapa.detalhe} <span className="sr-only">{etapa.ok ? "(passou)" : "(falhou)"}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
