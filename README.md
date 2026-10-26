# front_whitelabel

Front-end **whitelabel** de um sistema web de gestão para escritórios de contabilidade: clientes, guias de imposto, notas fiscais (NFS-e), financeiro e Fator R. Cada instalação tem a própria identidade visual (nome, logo, cores, fontes), escolhida **no build** por uma variável de ambiente, sem tocar nas telas.

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · TanStack Query · cmdk (command palette) · Phosphor Icons · TypeScript estrito. Testes: `node --test` (unidade) e Playwright + axe (E2E e acessibilidade).

> Este repositório é **só o front**. As telas conversam com uma API REST (`/api/v1`) que não está aqui — veja [Backend e contrato da API](#backend-e-contrato-da-api).

## O que tem dentro

| Tela | O que faz |
|---|---|
| Login | Sessão com token de acesso + refresh em cookie; volta para o destino pedido (`?next=`, só caminhos internos) |
| Painel | Um número dominante, métricas secundárias com sparkline, alertas e pendências |
| Clientes | Lista e detalhe lado a lado (master-detail), importação de CSV com verificação por linha |
| Guias | Cadastro, PDF, marcar como paga com comprovante, destaque de vencidas, estimativa de multa e juros |
| Notas fiscais | Emissão em nome do cliente, revisão, rejeição e reemissão, cancelamento, configuração fiscal por cliente |
| Financeiro / Fator R | Visão de valores a pagar e emitidos; cálculo do Fator R com a base de meses usada |
| Planos | Planos de serviço do escritório |
| Navegação | Menu lateral em acordeão (um grupo aberto por vez), gaveta no celular, **Ctrl+K** abre a busca/comando |

O desenho e as decisões de UI/UX estão em [`docs/ui-ux.md`](docs/ui-ux.md).

## Whitelabel em 30 segundos

```bash
BRAND=exemplo npm run dev      # sobe com a marca de exemplo (azul-petróleo, logo em SVG)
BRAND=exemplo npm run build    # build de produção com essa marca
```

Uma marca é uma pasta em `src/brands/<id>/` com dois arquivos: `marca.ts` (nome, descrição, logo, favicon, cores claras e escuras, raio) e `fonts.ts` (fontes do `next/font`). O teste unitário **reprova** qualquer marca com contraste abaixo de 4,5:1 (WCAG AA). A assinatura "Desenvolvido por AUTTOPUS" é fixa em toda marca. Passo a passo completo: [`docs/whitelabel.md`](docs/whitelabel.md).

## Como rodar

Requisitos: **Node 22 ou superior**.

```bash
npm ci
cp .env.example .env.local     # opcional: todas as variáveis têm padrão
npm run dev                    # http://localhost:3000
```

Sem a API no ar, o login não entra. O módulo de Notas Fiscais funciona sozinho em modo `demo` (dados fictícios no `localStorage`), mas Clientes, Guias e o restante precisam do backend.

### Variáveis de ambiente

| Variável | Padrão | O que faz |
|---|---|---|
| `BRAND` | `claudaccount` | Pasta de `src/brands` usada no build. Valor inexistente derruba o build com mensagem clara. |
| `BACKEND_URL` | `http://localhost:8080` | Destino do proxy `/api/*` em desenvolvimento. Em produção quem faz isso é um proxy reverso (nginx). |
| `NEXT_PUBLIC_NOTAS_FISCAIS` | `demo` no dev, vazio em produção | `demo` = simulação no navegador; `api` = backend de verdade; vazio = módulo oculto. |

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build de produção (saída `standalone`) e servidor |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Testes de unidade (`node --test`), incluindo a validação de contraste das marcas |
| `npm run test:e2e` | Playwright (precisa da API no ar; veja abaixo) |

## Estrutura

```
src/
  app/                 Rotas (App Router): login e a área logada em (app)/
  brands/<id>/         Uma pasta por marca: marca.ts + fonts.ts
  components/
    ui/                Botão, campo, combobox, modal, pill, toast, sparkline, estado vazio…
    shell/             Layout: menu lateral, topo, command palette, Logo, assinatura
    clientes/ notas/   Componentes de domínio
  lib/
    marca/             Tipos da marca, gerador de CSS do tema, validador de contraste
    notas/             Módulo de NFS-e (cliente da API + simulação em lib/notas/demo)
    types.ts           Contrato da API (tipos)
    api.ts             fetch com renovação automática de sessão
public/marcas/<id>/    Logo e ícone de cada marca
e2e/                   Playwright (inclui marca.spec.ts e acessibilidade.spec.ts)
docs/                  UI/UX e whitelabel
```

## Testes

- **Unidade** (`npm test`): formatação, CPF/CNPJ, regras de guia e Fator R, a simulação de notas e a **validação de contraste de todas as marcas**.
- **E2E** (`npm run test:e2e`): login e sessão, Clientes, Planos, Guias, Notas Fiscais, command palette, critério mobile (375 px e 390 px sem elemento além da largura) e auditoria **WCAG A/AA com axe em tema claro e escuro**. Roda contra um backend de desenvolvimento em `:8080` (`E2E_EMAIL`/`E2E_SENHA` trazem as credenciais; veja `e2e/helpers.ts`). O teste de certificado usa o `keytool` do JDK.
- **Marca:** `e2e/marca.spec.ts` confere nome, logo, cores, raio e a assinatura na marca em que o servidor foi construído e que nada de outra marca vaza para o HTML:

```bash
BRAND=exemplo npm run build && npx next start -p 3100
E2E_MARCA=exemplo E2E_BASE_URL=http://localhost:3100 npx playwright test marca.spec.ts --project=desktop
```

## Backend e contrato da API

O front chama `/api/v1/*` na mesma origem. Em desenvolvimento, `next.config.ts` repassa para `BACKEND_URL`; em produção, um proxy reverso faz o mesmo. A sessão usa um token de acesso e um cookie de refresh rotativo (`credentials: "same-origin"`); em 401 o `lib/api.ts` renova a sessão uma vez e repete a chamada.

Os recursos usados: `auth` (login, refresh, me), `clientes` (+ importação de CSV), `planos`, `guias` (+ PDF e comprovante), `financeiro`, `fator-r`, e no módulo fiscal `configuracao-fiscal`, `perfis-fiscais`, `tomadores` e `notas-fiscais`. **O contrato está em [`src/lib/types.ts`](src/lib/types.ts)**. Para o módulo de Notas Fiscais, `src/lib/notas/demo/servidor.test.ts` é a especificação executável das regras que um backend precisa repetir: ligar o backend real é trocar `NEXT_PUBLIC_NOTAS_FISCAIS` para `api`.

## Docker

```bash
docker build --build-arg BRAND=exemplo -t front-whitelabel .
docker run -p 3000:3000 front-whitelabel
```

A marca e o modo de Notas Fiscais ficam gravados no build (`BRAND`, `NEXT_PUBLIC_NOTAS_FISCAIS`). O contêiner só serve o front: o proxy de `/api` para a API fica por conta do proxy reverso da sua infraestrutura. O Dockerfile ainda não foi validado em um ambiente com Docker.

## Autoria e licença

Desenvolvido por **AUTTOPUS**. A assinatura "Desenvolvido por AUTTOPUS" no rodapé da área logada faz parte do produto e aparece em todas as marcas. Este repositório **ainda não tem licença definida**: sem uma licença, os direitos ficam reservados ao autor.
