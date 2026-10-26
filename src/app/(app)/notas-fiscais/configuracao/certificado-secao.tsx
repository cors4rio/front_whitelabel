"use client";

import { useState } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import { CampoArquivo } from "@/components/ui/campo-arquivo";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Pill } from "@/components/ui/pill";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { formatarDocumento } from "@/lib/documento";
import { dataBR, dataHoraBR } from "@/lib/format";
import { useEnviarCertificado, useRemoverCredencial } from "@/lib/notas/queries";
import type { PerfilFiscal } from "@/lib/types";

import { Item } from "../nota-resumo";

type Erros = { arquivo?: string; senha?: string };

/**
 * O certificado digital A1 do cliente: com ele a nota é assinada e a conexão com o sistema nacional é autenticada em
 * nome do cliente. O arquivo e a senha só existem aqui até o envio (a senha é limpa em seguida) e nunca voltam da API:
 * a tela mostra apenas titular, CNPJ e validade.
 */
export function CertificadoSecao({ perfil, somenteLeitura }: { perfil: PerfilFiscal; somenteLeitura: boolean }) {
  const toast = useToast();
  const enviar = useEnviarCertificado(perfil.clienteId);
  const remover = useRemoverCredencial(perfil.clienteId, "certificado");
  const [trocando, setTrocando] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);

  const certificado = perfil.certificado;
  const situacao = perfil.prontidao.find((i) => i.id === "CREDENCIAL")?.situacao;
  const mostrarFormulario = !certificado || trocando;

  async function aoEnviar(e: React.FormEvent) {
    e.preventDefault();
    const encontrados: Erros = {};
    if (!arquivo) encontrados.arquivo = "Escolha o arquivo do certificado (.pfx ou .p12)";
    if (!senha) encontrados.senha = "Informe a senha do certificado";
    // flushSync: o foco precisa ir para o campo inválido já renderizado com aria-invalid, não antes dele.
    flushSync(() => setErros(encontrados));
    if (Object.keys(encontrados).length > 0) {
      document.querySelector<HTMLElement>("#form-certificado [aria-invalid=true]")?.focus();
      return;
    }
    try {
      await enviar.mutateAsync({ arquivo: arquivo!, senha });
      toast.sucesso("Certificado enviado");
      setArquivo(null);
      setTrocando(false);
    } catch (erro) {
      if (erro instanceof ApiError && Object.keys(erro.campos).length > 0) setErros(erro.campos);
      else toast.erro(erro instanceof Error ? erro.message : "Não foi possível enviar o certificado.");
    } finally {
      setSenha(""); // a senha não fica na tela nem no estado depois do envio, deu certo ou não
      enviar.reset(); // e a requisição (com a senha) não fica guardada no estado da mutação
    }
  }

  async function confirmarRemocao() {
    try {
      await remover.mutateAsync();
      toast.sucesso("Certificado removido");
    } catch (erro) {
      toast.erro(erro instanceof Error ? erro.message : "Não foi possível remover o certificado.");
    } finally {
      setConfirmandoRemocao(false);
    }
  }

  return (
    <div>
      {certificado && (
        <div className="rounded-ui border border-line p-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 break-words font-semibold">{certificado.titular}</p>
            <Pill tom={situacao === "OK" ? "ok" : situacao === "ATENCAO" ? "atencao" : "problema"}>
              {situacao === "OK" ? "Válido" : situacao === "ATENCAO" ? "Vence em breve" : "Com problema"}
            </Pill>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-3">
            <Item rotulo="CNPJ do certificado">
              <span className="tabular-nums">{formatarDocumento(certificado.cnpj)}</span>
            </Item>
            <Item rotulo="Válido até">
              <span className="tabular-nums">{dataBR(certificado.validoAte)}</span>
            </Item>
            <Item rotulo="Enviado em">
              <span className="tabular-nums">{dataHoraBR(certificado.enviadoEm)}</span>
            </Item>
          </dl>
          {!somenteLeitura && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button pequeno onClick={() => setTrocando((v) => !v)} aria-expanded={trocando}>
                {trocando ? "Não substituir" : "Substituir certificado"}
              </Button>
              <Button pequeno variante="perigo" onClick={() => setConfirmandoRemocao(true)}>
                Remover certificado
              </Button>
            </div>
          )}
        </div>
      )}

      {!certificado && (
        <p className="rounded-ui border border-dashed border-line px-3.5 py-3 text-muted">
          Nenhum certificado enviado para este cliente. Sem ele a nota não pode ser assinada, então a emissão fica bloqueada.
        </p>
      )}

      {mostrarFormulario && !somenteLeitura && (
        <form id="form-certificado" onSubmit={aoEnviar} noValidate className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          <Field
            rotulo="Arquivo do certificado A1 do cliente"
            erro={erros.arquivo}
            dica="O certificado A1 do CNPJ ou CPF deste cliente, em arquivo .pfx ou .p12. O A3 (token ou cartão) não funciona em servidor."
            className="sm:col-span-2"
          >
            {(a) => (
              <CampoArquivo
                {...a}
                aceita=".pfx,.p12,application/x-pkcs12"
                arquivo={arquivo}
                onChange={(f) => {
                  setArquivo(f);
                  setErros((atual) => ({ ...atual, arquivo: undefined }));
                }}
              />
            )}
          </Field>
          <Field rotulo="Senha do certificado" erro={erros.senha}>
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
          <div className="flex items-end">
            <Button type="submit" variante={certificado ? "secundario" : "primario"} carregando={enviar.isPending}>
              Enviar certificado
            </Button>
          </div>
          <p className="text-[13px] text-muted sm:col-span-2">
            O arquivo e a senha seguem por conexão segura e ficam guardados de forma criptografada no servidor do escritório. Eles nunca aparecem de volta na tela.
          </p>
        </form>
      )}

      <Modal aberto={confirmandoRemocao} onFechar={() => setConfirmandoRemocao(false)} titulo="Remover o certificado?" largura="sm">
        <p>
          O certificado e a senha de <strong>{perfil.clienteNome}</strong> serão apagados do servidor. <strong>A emissão para este cliente fica bloqueada</strong> até
          um novo certificado ser enviado (ou até ele passar a emitir pelo portal).
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button data-autofocus onClick={() => setConfirmandoRemocao(false)}>
            Voltar
          </Button>
          <Button variante="perigo" carregando={remover.isPending} onClick={confirmarRemocao}>
            Remover certificado
          </Button>
        </div>
      </Modal>
    </div>
  );
}
