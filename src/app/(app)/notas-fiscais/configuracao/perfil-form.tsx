"use client";

import { useState } from "react";
import { flushSync } from "react-dom";

import { MunicipioCombobox } from "@/components/notas/municipio-combobox";
import { ServicoCombobox } from "@/components/notas/servico-combobox";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { dataBR } from "@/lib/format";
import { leituraDaSituacao, municipioPorIbge, MUNICIPIOS_REFERENCIA } from "@/lib/notas/municipios";
import { useSalvarPerfil } from "@/lib/notas/queries";
import { AVISO_CANAL_MUNICIPAL, SALVADOR_IBGE } from "@/lib/notas/regras";
import type { CanalEmissao, OpcaoSimples, PerfilFiscal, RegimeEspecial } from "@/lib/types";

const ID_FORM = "form-perfil";

const REGIMES_ESPECIAIS: { valor: RegimeEspecial; rotulo: string }[] = [
  { valor: "NENHUM", rotulo: "Nenhum" },
  { valor: "SOCIEDADE_PROFISSIONAIS", rotulo: "Sociedade de profissionais" },
  { valor: "MICROEMPRESA_MUNICIPAL", rotulo: "Microempresa municipal" },
  { valor: "PROFISSIONAL_AUTONOMO", rotulo: "Profissional autônomo" },
  { valor: "ESTIMATIVA", rotulo: "Estimativa" },
  { valor: "ATO_COOPERADO", rotulo: "Ato cooperado (cooperativa)" },
  { valor: "NOTARIO_REGISTRADOR", rotulo: "Notário ou registrador" },
  { valor: "OUTROS", rotulo: "Outros" },
];

interface Estado {
  inscricaoMunicipal: string;
  municipioIbge: string;
  opcaoSimples: OpcaoSimples | "";
  regimeEspecial: RegimeEspecial;
  canal: CanalEmissao;
  serieDps: string;
  servicoPadrao: string;
}

type Campo = keyof Estado;
type Erros = Partial<Record<Campo, string>>;

const estadoDe = (p: PerfilFiscal): Estado => ({
  inscricaoMunicipal: p.inscricaoMunicipal ?? "",
  municipioIbge: p.municipioIbge ?? "",
  opcaoSimples: p.opcaoSimples ?? "",
  regimeEspecial: p.regimeEspecial,
  canal: p.canal,
  serieDps: String(p.serieDps),
  servicoPadrao: p.servicoPadrao ?? "",
});

/** O backend é a autoridade; estas checagens só dão retorno imediato antes de enviar. */
function validar(e: Estado): Erros {
  const erros: Erros = {};
  if (e.inscricaoMunicipal.trim().length > 15) erros.inscricaoMunicipal = "Use no máximo 15 caracteres";
  if (!municipioPorIbge(e.municipioIbge)) erros.municipioIbge = "Escolha o município na lista";
  if (!e.opcaoSimples) erros.opcaoSimples = "Escolha o regime tributário";
  const serie = Number(e.serieDps);
  if (!/^\d+$/.test(e.serieDps) || serie < 1 || serie > 49999) erros.serieDps = "Use um número de 1 a 49999";
  return erros;
}

/** Os dados fiscais de um cliente como prestador: município, regime, como emite, série e serviço padrão. */
export function PerfilForm({ perfil, somenteLeitura }: { perfil: PerfilFiscal; somenteLeitura: boolean }) {
  const toast = useToast();
  const salvar = useSalvarPerfil(perfil.clienteId);
  const [estado, setEstado] = useState<Estado>(() => estadoDe(perfil));
  const [erros, setErros] = useState<Erros>({});

  const campo = <K extends Campo>(nome: K, valor: Estado[K]) => {
    setEstado((atual) => ({ ...atual, [nome]: valor }));
    if (erros[nome]) setErros((atual) => ({ ...atual, [nome]: undefined }));
  };

  const atual = estadoDe(perfil);
  const alterado = !perfil.configurado || (Object.keys(atual) as Campo[]).some((k) => estado[k] !== atual[k]);
  const municipio = municipioPorIbge(estado.municipioIbge);
  const leitura = municipio ? leituraDaSituacao(municipio) : null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (somenteLeitura) return;
    const encontrados = validar(estado);
    // flushSync: o foco precisa ir para o campo inválido já renderizado com aria-invalid, não antes dele.
    flushSync(() => setErros(encontrados));
    if (Object.keys(encontrados).length > 0) {
      document.getElementById(ID_FORM)?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    try {
      await salvar.mutateAsync({
        inscricaoMunicipal: estado.inscricaoMunicipal.trim() || null,
        municipioIbge: estado.municipioIbge,
        opcaoSimples: estado.opcaoSimples as OpcaoSimples,
        regimeEspecial: estado.regimeEspecial,
        canal: estado.canal,
        serieDps: Number(estado.serieDps),
        servicoPadrao: estado.servicoPadrao || null,
      });
      toast.sucesso("Dados fiscais salvos");
    } catch (erro) {
      if (erro instanceof ApiError && Object.keys(erro.campos).length > 0) setErros(erro.campos as Erros);
      else toast.erro(erro instanceof Error ? erro.message : "Não foi possível salvar os dados fiscais.");
    }
  }

  return (
    <form id={ID_FORM} onSubmit={enviar} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field rotulo="Município do cliente" erro={erros.municipioIbge} dica="É onde o cliente está inscrito para emitir nota. Digite o nome; “Santa Cruz RN” restringe ao estado.">
          {(a) => (
            <MunicipioCombobox
              {...a}
              valor={estado.municipioIbge}
              onChange={(ibge) => {
                campo("municipioIbge", ibge);
                // O canal municipal só existe para Salvador: saindo de Salvador, volta para o nacional.
                if (ibge !== SALVADOR_IBGE && estado.canal === "MUNICIPAL_SALVADOR") campo("canal", "NACIONAL");
              }}
              desabilitado={somenteLeitura}
            />
          )}
        </Field>
        {leitura && municipio && (
          <div
            role="status"
            className={`mt-2 rounded-ui border px-3 py-2.5 text-[13px] ${
              leitura.tom === "ok" ? "border-moss/60" : leitura.tom === "atencao" ? "border-amber/70 bg-amber/10" : "border-crimson bg-crimson/5"
            }`}
          >
            <p className={`font-semibold ${leitura.tom === "ok" ? "text-moss" : leitura.tom === "atencao" ? "text-amber-ink" : "text-crimson"}`}>{leitura.titulo}</p>
            <p>{leitura.detalhe}</p>
            <p className="mt-1 text-muted">
              Situação conforme a planilha de adesões do governo de {dataBR(MUNICIPIOS_REFERENCIA)}. A confirmação definitiva é o teste de conexão.
            </p>
          </div>
        )}
      </div>

      <Field rotulo="Regime tributário" erro={erros.opcaoSimples}>
        {(a) => (
          <Select {...a} required disabled={somenteLeitura} value={estado.opcaoSimples} onChange={(e) => campo("opcaoSimples", e.target.value as OpcaoSimples | "")}>
            <option value="">Escolha o regime</option>
            <option value="ME_EPP">Optante pelo Simples Nacional (ME/EPP)</option>
            <option value="MEI">MEI</option>
            <option value="NAO_OPTANTE">Não optante pelo Simples Nacional</option>
          </Select>
        )}
      </Field>

      <Field rotulo="Inscrição municipal (opcional)" erro={erros.inscricaoMunicipal}>
        {(a) => <Input {...a} disabled={somenteLeitura} autoComplete="off" value={estado.inscricaoMunicipal} onChange={(e) => campo("inscricaoMunicipal", e.target.value)} />}
      </Field>

      <Field rotulo="Regime especial de tributação" erro={erros.regimeEspecial} dica="Em geral, “Nenhum”. Sociedade de profissionais é o caso de ISS fixo.">
        {(a) => (
          <Select {...a} disabled={somenteLeitura} value={estado.regimeEspecial} onChange={(e) => campo("regimeEspecial", e.target.value as RegimeEspecial)}>
            {REGIMES_ESPECIAIS.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.rotulo}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field rotulo="Serviço padrão das notas" erro={erros.servicoPadrao} dica="Já vem escolhido ao emitir uma nota deste cliente.">
        {(a) => <ServicoCombobox {...a} valor={estado.servicoPadrao} onChange={(codigo) => campo("servicoPadrao", codigo)} desabilitado={somenteLeitura} />}
      </Field>

      <fieldset className="min-w-0 sm:col-span-2" disabled={somenteLeitura}>
        <legend className="mb-1.5 text-[13px] font-medium">Por onde este cliente emite (canal padrão)</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          {(
            [
              { valor: "NACIONAL", titulo: "Nacional, com certificado digital", texto: "Pela API do sistema nacional, com o certificado A1 do cliente. É o caminho padrão e o mais confiável.", habilitado: true },
              {
                valor: "MUNICIPAL_SALVADOR",
                titulo: "Municipal de Salvador, sem certificado",
                texto: "Pelo portal da Prefeitura de Salvador, com o usuário e a senha do cliente. Só para clientes de Salvador; mais lento e frágil.",
                habilitado: estado.municipioIbge === SALVADOR_IBGE,
              },
            ] as const
          ).map((o) => (
            <label
              key={o.valor}
              className={`flex flex-1 items-start gap-3 rounded-ui border border-line p-3 has-[:checked]:border-accent ${
                o.habilitado ? "cursor-pointer" : "cursor-default opacity-60"
              } has-[:disabled]:cursor-default has-[:disabled]:opacity-60`}
            >
              <input
                type="radio"
                name="canal"
                value={o.valor}
                checked={estado.canal === o.valor}
                disabled={!o.habilitado}
                onChange={() => campo("canal", o.valor)}
                className="mt-0.5 size-4 shrink-0 accent-accent"
              />
              <span>
                <span className="block font-medium">{o.titulo}</span>
                <span className="block text-[13px] text-muted">{o.texto}</span>
                {!o.habilitado && <span className="mt-1 block text-[13px] font-medium">Disponível quando o município do cliente for Salvador.</span>}
              </span>
            </label>
          ))}
        </div>
        {estado.canal === "MUNICIPAL_SALVADOR" && (
          <p role="note" className="mt-2 rounded-ui border border-amber/70 bg-amber/10 px-3 py-2.5 text-[13px]">
            <strong>Atenção:</strong> {AVISO_CANAL_MUNICIPAL}
          </p>
        )}
        <p className="mt-1.5 text-[13px] text-muted">É só o canal sugerido: cada nota pode sair por outro, se o cliente tiver os dois prontos.</p>
      </fieldset>

      <Field rotulo="Série da DPS" erro={erros.serieDps} dica="De 1 a 49999: a faixa das notas emitidas por aplicativo próprio.">
        {(a) => <Input {...a} required inputMode="numeric" disabled={somenteLeitura} value={estado.serieDps} onChange={(e) => campo("serieDps", e.target.value)} />}
      </Field>

      <div>
        <p className="text-[13px] font-medium">Próximo número da DPS</p>
        <p className="mt-2 text-[15px] font-semibold tabular-nums">{perfil.proximoNumeroDps}</p>
        <p className="mt-1 text-[13px] text-muted">Controlado pelo sistema: cada tentativa de emissão usa o seguinte.</p>
      </div>

      {!somenteLeitura && (
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" variante="primario" carregando={salvar.isPending} disabled={!alterado}>
            Salvar dados fiscais
          </Button>
        </div>
      )}
    </form>
  );
}
