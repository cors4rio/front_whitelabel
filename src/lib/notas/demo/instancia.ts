import { api } from "../../api";
import { hojeNoEscritorio } from "../../format";
import type { Cliente, Financeiro, Pagina, Usuario } from "../../types";
import { armazenamentoDoNavegador, atrasoDoNavegador } from "./armazenamento";
import { ServidorDemo } from "./servidor";

let instancia: ServidorDemo | null = null;

/**
 * A simulação deste navegador. O tomador de uma nota vem do cadastro de clientes de verdade (essa parte do
 * sistema já existe) e o nome de quem agiu, do usuário logado.
 */
export function servidorDemo(): ServidorDemo {
  instancia ??= new ServidorDemo({
    armazenamento: armazenamentoDoNavegador(),
    agora: () => new Date(),
    hoje: hojeNoEscritorio,
    atrasoMs: atrasoDoNavegador,
    latenciaMs: 120,
    buscarCliente: async (id) => {
      try {
        const c = await api<Cliente>(`/clientes/${id}`);
        return { id: c.id, nome: c.nomeRazaoSocial, documento: c.cpfCnpj };
      } catch {
        return null;
      }
    },
    financeiroDasGuias: (mes) => api<Financeiro>(`/financeiro?mes=${mes}`),
    listarClientes: async ({ busca, tamanho }) => {
      const pagina = await api<Pagina<Cliente>>(`/clientes?busca=${encodeURIComponent(busca)}&status=ATIVO&size=${tamanho}`);
      return pagina.content.map((c) => ({ id: c.id, nome: c.nomeRazaoSocial, documento: c.cpfCnpj }));
    },
    nomeDoUsuario: async () => {
      try {
        return (await api<Usuario>("/auth/me")).nome;
      } catch {
        return null;
      }
    },
  });
  return instancia;
}
