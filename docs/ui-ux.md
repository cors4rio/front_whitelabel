# UI/UX

Decisões de interface do front. O código referencia estas seções pelo número (por exemplo, "docs/ui-ux.md, seção 6"). As cores e o raio de cada marca vivem em `src/brands/<id>/marca.ts`; os valores abaixo são os da marca padrão (`claudaccount`).

## 1. Princípios

- **Estrutura antes de decoração.** Teste de aceite para qualquer tela nova: *"essa estrutura seria idêntica se eu trocasse a paleta?"* Se sim, o problema de design não foi resolvido: só se trocou a pele. Por isso o sistema usa lista com detalhe ao lado e hierarquia por tamanho, em vez de tabela com janela e grade de cartões iguais.
- **Uma ação primária por tela.** Uma só cor de ação por tela, em um só elemento de mesma hierarquia.
- **Ferramenta de uso diário.** O público trabalha no sistema o dia todo: densidade compacta, teclado em primeiro lugar (Ctrl+K) e nada de respiro de página de marketing.
- **Estado é forma, não só cor.** Todo status tem rótulo.
- **Hierarquia vem de peso tipográfico e espaçamento**, não de raio ou sombra crescentes.

## 2. Cor

Tokens semânticos (`bg`, `fg`, `line`, `paper`, `muted`, `accent`, `accentText`, `onAccent`, `moss`, `amber`, `amberInk`, `crimson`, `sidebar*`), declarados por marca e injetados como variáveis CSS pelo layout. Os componentes usam só os utilitários (`bg-accent`, `text-fg`, `border-line`…): **nenhum componente tem hexadecimal de marca**.

Marca padrão: coral `#E8542A` sobre neutros quentes (creme `#FAF6F0`, areia `#E8DFD3`, tinta `#241C1A`).

- **Regra de composição:** a superfície é ~90% neutra; o acento aparece em no máximo ~10% de uma tela (botão primário, ícone ativo, um destaque). Nunca em um cartão inteiro.
- **Cores semânticas separadas do acento da marca:** verde = sucesso/pago/ativo, âmbar = atenção/vencendo, vermelho = erro/vencido/rejeitado. O acento nunca significa "sucesso" nem "erro": não se confunde ação com problema.
- **Neutros quentes**, nunca `#000` puro nem cinza frio.
- **Texto sobre o acento:** a marca padrão usa texto escuro sobre o coral (4,6:1) porque branco daria 3,7:1. Texto de acento sobre fundo claro usa o tom `accentText` (mais escuro, 5,7:1).
- **Tema claro por padrão.** O sistema ignora `prefers-color-scheme`. O escuro está pronto em cada marca (`cores.escuro`) e vale só com `<html data-theme="dark">` (ainda sem seletor na tela).

## 3. Tipografia

Fontes com personalidade em vez de uma fonte neutra "segura". Marca padrão: **Bricolage Grotesque** (títulos e números de destaque, pesos 600 e 700) e **Plus Jakarta Sans** (interface, pesos 400, 500 e 600). Cada marca declara as suas em `fonts.ts` (`--font-marca-display` e `--font-marca-texto`).

- Escala base 16 px, razão ~1,25: 12 / 14 / 16 / 20 / 25 / 32 / 40; o número dominante do Painel chega a ~64 px.
- Corpo da interface em 14 px.
- **Dados tabulares** (valores, datas, CPF/CNPJ) usam `tabular-nums` para os dígitos alinharem em coluna.

## 4. Superfície: borda, não sombra

- Cartões, painéis e linhas: borda de 1 px (`line`) e raio da marca (10 px na padrão). **Sem sombra.**
- Sombra só no que flutua sobre o conteúdo: modal, menu/popover, command palette.
- Um só valor de raio por tela; o raio vem da marca (`--radius-ui`).
- **Números grandes como elemento gráfico:** os KPIs fazem o papel que um ícone em círculo colorido faria. Esse clichê é evitado.

## 5. Navegação

- **Menu lateral** (≥ 1024 px): fixo, 240 px, fundo escuro da marca. Em **acordeão**: abrir um grupo recolhe os outros, e ao chegar numa tela de um grupo (por link, atalho ou busca) ele abre. Entradas: Painel, Clientes, Fiscal (Notas fiscais e Guias), Financeiro, Fator R, Planos.
- **Celular e tablet** (< 1024 px): topo com botão de menu e busca; o menu vira **gaveta** de 85% da largura (máx. 320 px) com fundo escurecido, fecha ao tocar fora e é um diálogo modal (`aria-modal`); fechada, fica inerte e fora da ordem de tabulação. Nenhuma tela fica inacessível por causa do menu em 375 px e 390 px (testado).
- **Alvos de toque** de 44 px nos controles do topo.
- **Command palette (Ctrl+K / Cmd+K):** busca de clientes, ações e atalhos para qualquer seção, 100% por teclado (↑↓ move, Enter escolhe, Esc fecha). Não substitui o menu: é para quem já sabe o que quer. O atalho aparece no menu como dica permanente.

## 6. Lista e detalhe lado a lado (master-detail)

Clientes, Guias e Notas fiscais **não abrem modal** para ver um registro.

- **≥ 900 px:** duas colunas, lista ~45% e detalhe ~55%, lado a lado. O detalhe fica fixo no topo ao rolar (`sticky`). O usuário nunca perde o contexto nem o scroll da lista.
- **< 900 px:** a lista ocupa a tela; tocar num registro mostra o detalhe em tela cheia, com botão de voltar. O princípio é o mesmo, só a apresentação vira sequencial.
- O registro aberto tem **URL própria** (`/clientes?id=123`), então dá para compartilhar o link.
- **Estado vazio do detalhe** nunca é um branco: "Selecione um cliente para ver os detalhes".
- **Linha da lista:** só o essencial para escanear (nome, 1 a 2 campos, status em pill). Separação por espaçamento mais que por linhas de grade. Densidade compacta.
- **Modal só para** confirmação destrutiva curta ("Excluir cliente?") e criação rápida com formulário muito curto.

## 7. Painel: hierarquia por tamanho

Não é uma linha de cartões iguais competindo por atenção.

- **Um número dominante** em tipografia grande: o que a pessoa mais precisa saber agora.
- **Métricas secundárias** em linhas compactas, cada uma com o número e uma **sparkline embutida** ao lado: o gráfico é conteúdo da linha, não um widget com título e legenda.
- **Alertas e pendências** como lista compacta (ícone semântico + texto), não como cartões.

## 8. Notas fiscais

- **Lista:** prestador (o cliente do escritório), tomador, valor, status em pill e data.
- **Detalhe:** dados completos, **linha do tempo vertical** do que aconteceu com a nota (rascunho, enviada, autorizada…, com data e hora de cada etapa) e ações no cabeçalho do detalhe (reemitir, cancelar, baixar XML/PDF), com as menos frequentes no menu "Mais ações".
- **Nota rejeitada:** o motivo aparece em **destaque no topo do detalhe**, com borda de erro (código e mensagem), não numa linha expansível.
- **Dois canais de emissão** por cliente, com avisos explícitos na tela quando a emissão é por acesso ao portal (sem certificado).
- **Retenções federais** no formulário; só o perfil administrador altera a configuração fiscal.

## 9. Guias

- **Lista:** descrição, valor, vencimento e status. A urgência vai na **cor do texto da data**: vermelho se vencida, âmbar se está para vencer (a janela é definida pelo backend), normal no resto (sem borda lateral decorativa).
- **Detalhe:** valor, vencimento, histórico de pagamento, PDF e "Marcar como paga" com comprovante. Guia vencida mostra uma **estimativa** de multa e juros, sempre rotulada como estimativa: o valor oficial vem da fonte.

## 10. Componentes

| Componente | Regra |
|---|---|
| `Button` | Um só primário por tela; texto sobre o acento escolhido para contraste AA |
| `Field` / `Input` | Rótulo sempre visível e associado; erro em texto, ligado ao campo |
| `Combobox` | Busca com teclado; usado para cliente, município, serviço e tomador |
| `Pill` | Borda + texto, 4 tons (ok, atenção, problema, neutro); nunca uma bolinha sozinha |
| `Modal` | Elemento `<dialog>` nativo (foco preso, Esc e papel corretos); só para confirmação e criação curta |
| `Toast` | Confirmação no passado ("Nota emitida"), nunca "Sucesso!" |
| `Sparkline` | Mini gráfico de barras em SVG, sem eixo nem grade; sempre ao lado do número que descreve |
| `EmptyState` | Ícone simples + texto de orientação + chamada para ação |
| `Logo` | Logo da marca; sem logo cadastrado, mostra o nome em texto |

Ícones: **Phosphor**, sem emoji como marcador de interface.

## 11. Microcopy

- Direto e sem jargão interno: "Guia vence em 3 dias", não "Status: D-3".
- Ação no passado na confirmação.
- Erro explica **o que houve e o que fazer**: "Não foi possível emitir a nota: CNPJ do tomador inválido. Verifique o cadastro do cliente." Nunca "Erro ao processar solicitação".
- Amigável é clareza, não simpatia performática.

## 12. Acessibilidade

- **Contraste AA** em todas as marcas, claro e escuro, **verificado por teste** (`src/lib/marca/marca.test.ts`) e por auditoria **axe** nas telas (`e2e/acessibilidade.spec.ts`).
- Foco visível (`:focus-visible` com o tom de acento) e navegação completa por teclado, inclusive a command palette.
- `prefers-reduced-motion` respeitado: animações e transições praticamente desligadas.
- Status sempre com texto; rótulos de formulário associados; `aria-label` no menu, na gaveta e nas ações só com ícone.
- Layout testado em 375 px e 390 px, sem rolagem horizontal.

## 13. Assinatura "Desenvolvido por AUTTOPUS"

A empresa desenvolvedora assina o produto com um texto pequeno no **rodapé da área logada** (componente `Assinatura`): "Desenvolvido por" + wordmark AUTTOPUS em fonte própria (Oswald, caixa alta, "O" em laranja `#FD8916`). É a **única** parte do produto fora da paleta da marca.

- Aparece em **toda marca**: não é configurável por instalação.
- **Não aparece no login**, para não competir com a identidade do produto naquele fluxo.
- Nunca domina nem substitui a identidade visual da marca.
