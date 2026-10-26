import { apiBlob } from "./api";

/**
 * Abre um arquivo protegido numa nova aba. A aba é aberta de forma síncrona, ainda dentro do clique, e só
 * depois recebe o endereço: se esperasse o download para abrir, navegadores (Safari em especial) tratariam como
 * pop-up não solicitado e bloqueariam.
 */
export async function abrirArquivo(caminho: string, obter: (caminho: string) => Promise<Blob> = apiBlob): Promise<void> {
  const aba = window.open("", "_blank");
  if (!aba) throw new Error("O navegador bloqueou a nova aba. Libere pop-ups para este site ou use Baixar.");
  aba.opener = null;
  try {
    const url = URL.createObjectURL(await obter(caminho));
    aba.location.href = url;
    // O blob precisa continuar vivo enquanto a aba o carrega; liberar depois de um tempo evita vazar memória.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (erro) {
    aba.close();
    throw erro;
  }
}

/** Baixa um arquivo protegido com o nome dado. */
export async function baixarArquivo(caminho: string, nome: string, obter: (caminho: string) => Promise<Blob> = apiBlob): Promise<void> {
  const url = URL.createObjectURL(await obter(caminho));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
