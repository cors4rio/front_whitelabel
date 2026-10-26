"use client";

import { useState } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { dataHoraBR } from "@/lib/format";
import { useRemoverCredencial, useSalvarPortal } from "@/lib/notas/queries";
import { AVISO_CANAL_MUNICIPAL } from "@/lib/notas/regras";
import { descricaoDoServico, formatarCodigoServico } from "@/lib/notas/servicos";
import type { PerfilFiscal } from "@/lib/types";

import { Item } from "../nota-resumo";

type Erros = { usuario?: string; senha?: string };

/**
 * O acesso do cliente ao portal da Prefeitura de Salvador (canal municipal, sem certificado). É o caminho mais frágil
 * (captcha, mudanças na página), por isso o aviso fica sempre à vista. A senha segue criptografada e nunca volta da
 * API. Ao salvar o acesso, o sistema lê no portal as atividades do cliente: são os serviços que a nota municipal aceita.
 */
export function PortalSecao({ perfil, somenteLeitura }: { perfil: PerfilFiscal; somenteLeitura: boolean }) {
  const toast = useToast();
  const salvar = useSalvarPortal(perfil.clienteId);
  const remover = useRemoverCredencial(perfil.clienteId, "portal");
  const [trocando, setTrocando] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);

  const portal = perfil.portal;
  const mostrarFormulario = !portal || trocando;

  async function aoEnviar(e: React.FormEvent) {
    e.preventDefault();
    const encontrados: Erros = {};
    if (!usuario.trim()) encontrados.usuario = "Informe o usuário do portal";
    if (!senha) encontrados.senha = "Informe a senha do portal";
    // flushSync: o foco precisa ir para o campo inválido já renderizado com aria-invalid, não antes dele.
    flushSync(() => setErros(encontrados));
    if (Object.keys(encontrados).length > 0) {
      document.querySelector<HTMLElement>("#form-portal [aria-invalid=true]")?.focus();
      return;
    }
    try {
      await salvar.mutateAsync({ usuario: usuario.trim(), senha });
      toast.sucesso("Acesso ao portal salvo");
      setUsuario("");
      setTrocando(false);
    } catch (erro) {
      if (erro instanceof ApiError && Object.keys(erro.campos).length > 0) setErros(erro.campos);
      else toast.erro(erro instanceof Error ? erro.message : "Não foi possível salvar o acesso ao portal.");
    } finally {
      setSenha(""); // a senha não fica na tela nem no estado depois do envio, deu certo ou não
      salvar.reset();
    }
  }

  async function confirmarRemocao() {
    try {
      await remover.mutateAsync();
      toast.sucesso("Acesso ao portal removido");
    } catch (erro) {
      toast.erro(erro instanceof Error ? erro.message : "Não foi possível remover o acesso ao portal.");
    } finally {
      setConfirmandoRemocao(false);
    }
  }

  return (
    <div>
      <p role="note" className="mb-4 rounded-ui border border-amber/70 bg-amber/10 px-3 py-2.5 text-[13px]">
        <strong>Atenção:</strong> {AVISO_CANAL_MUNICIPAL}
      </p>

      {portal && (
        <div className="rounded-ui border border-line p-3.5">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Item rotulo="Usuário no portal">{portal.usuario}</Item>
            <Item rotulo="Atualizado em">
              <span className="tabular-nums">{dataHoraBR(portal.atualizadoEm)}</span>
            </Item>
          </dl>
          {perfil.atividadesMunicipais.length > 0 && (
            <div className="mt-3">
              <p className="text-[13px] text-muted">Atividades do cliente no portal (os serviços que a nota municipal aceita)</p>
              <ul className="mt-1 list-disc pl-5">
                {perfil.atividadesMunicipais.map((a) => (
                  <li key={a.codigoServico}>
                    <span className="tabular-nums">{formatarCodigoServico(a.codigoServico)}</span> · {descricaoDoServico(a.codigoServico) ?? "—"}{" "}
                    <span className="text-[13px] text-muted">(ISS {String(a.aliquota).replace(".", ",")}%)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!somenteLeitura && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button pequeno onClick={() => setTrocando((v) => !v)} aria-expanded={trocando}>
                {trocando ? "Não alterar" : "Alterar usuário ou senha"}
              </Button>
              <Button pequeno variante="perigo" onClick={() => setConfirmandoRemocao(true)}>
                Remover acesso
              </Button>
            </div>
          )}
        </div>
      )}

      {!portal && (
        <p className="rounded-ui border border-dashed border-line px-3.5 py-3 text-muted">
          Nenhum acesso ao portal guardado para este cliente. Sem ele o sistema não consegue entrar no portal para emitir.
        </p>
      )}

      {mostrarFormulario && !somenteLeitura && (
        <form id="form-portal" onSubmit={aoEnviar} noValidate className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          <Field rotulo="Usuário no portal (CNPJ ou CPF)" erro={erros.usuario}>
            {(a) => (
              <Input
                {...a}
                autoComplete="off"
                value={usuario}
                onChange={(e) => {
                  setUsuario(e.target.value);
                  setErros((atual) => ({ ...atual, usuario: undefined }));
                }}
              />
            )}
          </Field>
          <Field rotulo="Senha no portal" erro={erros.senha}>
            {(a) => (
              <Input
                {...a}
                type="password"
                autoComplete="new-password"
                value={senha}
                onChange={(e) => {
                  setSenha(e.target.value);
                  setErros((atual) => ({ ...atual, senha: undefined }));
                }}
              />
            )}
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" variante={portal ? "secundario" : "primario"} carregando={salvar.isPending}>
              Salvar acesso ao portal
            </Button>
          </div>
          <p className="text-[13px] text-muted sm:col-span-2">
            A senha segue por conexão segura e fica guardada de forma criptografada no servidor do escritório. Ela nunca aparece de volta na tela.
          </p>
        </form>
      )}

      <Modal aberto={confirmandoRemocao} onFechar={() => setConfirmandoRemocao(false)} titulo="Remover o acesso ao portal?" largura="sm">
        <p>
          O usuário e a senha de <strong>{perfil.clienteNome}</strong> serão apagados do servidor. <strong>A emissão para este cliente fica bloqueada</strong> até
          um novo acesso ser salvo.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button data-autofocus onClick={() => setConfirmandoRemocao(false)}>
            Voltar
          </Button>
          <Button variante="perigo" carregando={remover.isPending} onClick={confirmarRemocao}>
            Remover acesso
          </Button>
        </div>
      </Modal>
    </div>
  );
}
