import type { Sessao } from "./types";

/** Erro de API já com mensagem pronta para o usuário (vem do campo "detail" do ProblemDetail do backend). */
export class ApiError extends Error {
  readonly status: number;
  readonly campos: Record<string, string>;

  // Campos explícitos, sem "propriedades de parâmetro": o Node roda os testes tirando só os tipos, e essa sintaxe não passa.
  constructor(status: number, message: string, campos: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.campos = campos;
  }
}

const MSG_GENERICA = "Algo deu errado. Tente novamente em instantes.";
const MSG_SEM_CONEXAO = "Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.";

// O access token vive só em memória (nunca em localStorage): um XSS não consegue levá-lo embora para
// reutilizar depois. O refresh token fica num cookie httpOnly que o JavaScript nem enxerga.
let accessToken: string | null = null;
let aoPerderSessao: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setAoPerderSessao(handler: (() => void) | null) {
  aoPerderSessao = handler;
}

let renovando: Promise<Sessao | null> | null = null;

/**
 * Troca o refresh token por uma sessão nova. O backend rotaciona o token a cada uso e, ao ver um token
 * antigo reaparecer, derruba todas as sessões (sinal de roubo). Por isso este fluxo é:
 *  - de voo único: chamadas simultâneas na mesma aba compartilham a mesma requisição (cobre o duplo
 *    efeito do React StrictMode em desenvolvimento);
 *  - serializado entre abas (Web Locks): a segunda aba espera a primeira terminar e já lê o cookie novo.
 */
export function renovarSessao(): Promise<Sessao | null> {
  renovando ??= comTrava(async () => {
    try {
      const res = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "same-origin" });
      if (!res.ok) {
        accessToken = null;
        return null;
      }
      const sessao = (await res.json()) as Sessao;
      accessToken = sessao.accessToken;
      return sessao;
    } catch {
      return null;
    }
  }).finally(() => {
    renovando = null;
  });
  return renovando;
}

function comTrava<T>(tarefa: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    // O tipo do DOM embrulha o retorno do callback numa Promise a mais; em runtime ela já vem achatada.
    return navigator.locks.request("contabil-auth-refresh", tarefa) as unknown as Promise<T>;
  }
  return tarefa();
}

export interface Opcoes extends Omit<RequestInit, "body"> {
  json?: unknown;
  body?: BodyInit | null;
}

/** Faz a requisição (/api/v1 + caminho). Em 401 tenta renovar a sessão uma vez e repete. Só devolve respostas ok. */
async function requisitar(caminho: string, opcoes: Opcoes = {}): Promise<Response> {
  const { json, headers: headersExtras, ...resto } = opcoes;

  const executar = () => {
    const headers = new Headers(headersExtras);
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    let body = resto.body;
    if (json !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(json);
    }
    return fetch(`/api/v1${caminho}`, { ...resto, headers, body, credentials: "same-origin" });
  };

  let resposta: Response;
  try {
    resposta = await executar();
    if (resposta.status === 401 && !caminho.startsWith("/auth/")) {
      const sessao = await renovarSessao();
      if (!sessao) {
        aoPerderSessao?.();
        throw new ApiError(401, "Sua sessão expirou. Entre novamente.");
      }
      resposta = await executar();
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, MSG_SEM_CONEXAO);
  }

  if (!resposta.ok) throw await lerErro(resposta);
  return resposta;
}

/** Chama a API e devolve o JSON (ou undefined em 204). */
export async function api<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const resposta = await requisitar(caminho, opcoes);
  if (resposta.status === 204) return undefined as T;
  return (await resposta.json()) as T;
}

/**
 * Baixa um arquivo protegido como Blob. O token de acesso vive em memória (não em cookie), então um link
 * <a href> ou um <iframe src> iria sem login: a interface busca por aqui e mostra o resultado por URL de blob.
 */
export async function apiBlob(caminho: string): Promise<Blob> {
  return (await requisitar(caminho)).blob();
}

async function lerErro(resposta: Response): Promise<ApiError> {
  try {
    const problema = (await resposta.json()) as { detail?: string; title?: string; errors?: Record<string, string> };
    return new ApiError(resposta.status, problema.detail ?? problema.title ?? MSG_GENERICA, problema.errors ?? {});
  } catch {
    return new ApiError(resposta.status, resposta.status >= 500 ? MSG_GENERICA : `Erro ${resposta.status}.`);
  }
}
