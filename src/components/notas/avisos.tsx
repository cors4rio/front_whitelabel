"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { reiniciarDemonstracao } from "@/lib/notas/cliente-api";
import { useConfiguracaoFiscal } from "@/lib/notas/queries";

/**
 * Avisos que valem para todas as telas do módulo, no topo: demonstração (dados fictícios) e homologação. Somem
 * sozinhos quando não se aplicam; em produção, a tela não tem nenhum. O que falta para cada cliente emitir aparece no
 * próprio cliente (formulário da nota e dados fiscais), não aqui.
 * {@code apenasDemonstracao}: a tela de configuração mostra o ambiente por conta própria.
 */
export function AvisosDasNotas({ apenasDemonstracao = false }: { apenasDemonstracao?: boolean }) {
  const { data: config } = useConfiguracaoFiscal();
  // O texto `process.env.NEXT_PUBLIC_NOTAS_FISCAIS` por extenso deixa o bundler descartar a demonstração fora do modo demo (ver cliente-api.ts).
  const demonstracao = process.env.NEXT_PUBLIC_NOTAS_FISCAIS === "demo";
  const homologacao = config?.ambiente === "HOMOLOGACAO" && !apenasDemonstracao;

  if (!demonstracao && !homologacao) return null;
  return (
    <div className="mb-5 flex flex-col gap-3">
      {demonstracao && <AvisoDeDemonstracao />}
      {homologacao && (
        <p role="note" className="text-[13px] text-muted">
          <strong className="font-semibold text-amber-ink">Ambiente de homologação:</strong> as notas emitidas são de teste e não têm validade fiscal.
        </p>
      )}
    </div>
  );
}

const COMO_SIMULAR = [
  "Cliente novo: antes de emitir, abra os dados fiscais dele (Configuração fiscal) e informe município, regime e certificado ou portal.",
  "Serviço do item 14 da lista (como 14.01.01): a nota é rejeitada (E0312).",
  "Competência anterior a 01/05/2025: rejeitada (E1270).",
  "ISS retido com prestador MEI (E0583) ou com regime especial (E0588): rejeitada.",
  "Cliente de Salvador: configure o acesso ao portal (canal municipal) e emita por ele; a nota demora o triplo e descrição com a palavra “captcha” é rejeitada (PORTAL01).",
  "Cancelar nota emitida há mais de 30 dias: recusado (E0822).",
  "Certificado: nome do arquivo com “vencido” ou “outro”, ou senha “errada”. Portal: senha “errada”.",
];

function AvisoDeDemonstracao() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [restaurando, setRestaurando] = useState(false);

  async function restaurar() {
    setRestaurando(true);
    try {
      await reiniciarDemonstracao();
      await queryClient.invalidateQueries({ queryKey: ["notas"] });
      await queryClient.invalidateQueries({ queryKey: ["perfis"] });
      router.replace("/notas-fiscais");
      toast.sucesso("Dados de exemplo restaurados");
    } finally {
      setRestaurando(false);
    }
  }

  return (
    <section aria-label="Modo demonstração" className="rounded-ui border border-dashed border-amber/70 bg-amber/10 px-4 py-3 text-[13px]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 basis-72">
          <strong className="font-semibold">Modo demonstração.</strong> Os dados fiscais, tomadores e notas são fictícios, ficam só neste navegador e nada é enviado à Receita.
          O módulo de verdade entra quando o backend de notas fiscais existir.
        </p>
        <Button pequeno carregando={restaurando} onClick={restaurar}>
          Restaurar dados de exemplo
        </Button>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer font-medium">Como simular cada situação</summary>
        <ul className="mt-1.5 list-disc pl-5">
          {COMO_SIMULAR.map((linha) => (
            <li key={linha}>{linha}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
