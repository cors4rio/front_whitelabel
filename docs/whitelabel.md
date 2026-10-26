# Whitelabel

Cada instalação tem a própria identidade visual, escolhida **no build** pela variável `BRAND`. Uma marca define: nome, descrição, logo (claro e escuro), favicon, cores (tema claro e escuro), raio dos cantos e fontes. Tudo o mais (estrutura das telas, textos de negócio, comportamento) é igual para todas.

> **Regra fixa:** a assinatura "Desenvolvido por AUTTOPUS" aparece em **todas** as marcas e não é configurável. Ela não faz parte da marca.

## Usar uma marca

```bash
BRAND=exemplo npm run dev
BRAND=exemplo npm run build
```

Sem `BRAND`, vale `claudaccount`. Se o valor não existir em `src/brands/`, o build para com: `BRAND="x" não existe: crie src/brands/x/marca.ts e fonts.ts`. No Docker, passe `--build-arg BRAND=<id>`.

A marca fica gravada no build: para trocar de marca é preciso construir de novo. Uma marca editável em tempo de execução (tela de "Aparência") **não faz parte** desta versão.

## Criar uma marca nova

1. **Copie** `src/brands/exemplo` para `src/brands/<id>`. O `<id>` usa só letras minúsculas, números e hífen.
2. **Edite `marca.ts`.** Dados puros, sem imports de React nem do Next:

   ```ts
   export const marca: Marca = {
     id: "minha-marca",                 // igual ao nome da pasta
     nome: "Minha Marca",               // título da aba e texto do menu/login
     descricao: "…",                    // metadata do site
     favicon: "/marcas/minha-marca/icone.svg",   // opcional
     logo: {                            // opcional; sem logo, aparece o nome em texto
       sobreClaro: "/marcas/minha-marca/logo.svg",
       sobreEscuro: "/marcas/minha-marca/logo-claro.svg",
       altura: 28,
     },
     raio: "10px",
     cores: { claro: { /* 16 tokens */ }, escuro: { /* 16 tokens */ } },
   };
   ```

3. **Edite `fonts.ts`.** O `next/font` exige chamadas literais, por isso as fontes ficam num módulo da marca. O contrato é exportar `fontesDaMarca` com as duas variáveis CSS:

   ```ts
   import { Inter, Sora } from "next/font/google";

   const display = Sora({ variable: "--font-marca-display", subsets: ["latin"], weight: ["600", "700"] });
   const texto = Inter({ variable: "--font-marca-texto", subsets: ["latin"], weight: ["400", "500", "600"] });

   export const fontesDaMarca = `${display.variable} ${texto.variable}`;
   ```

4. **Coloque os arquivos** de logo e ícone em `public/marcas/<id>/` (SVG ou PNG). Use uma versão para fundo claro (login e topo no celular) e outra para o menu lateral escuro.
5. **Rode `npm test`.** O teste de contraste reprova a marca se algum par texto/fundo ficar abaixo de 4,5:1.
6. **Veja funcionando:** `BRAND=<id> npm run dev`.

## Os 16 tokens de cor

| Token | Uso |
|---|---|
| `bg` | Fundo da página |
| `fg` | Texto principal |
| `line` | Bordas e divisórias |
| `paper` | Cartões e formulários |
| `muted` | Texto secundário |
| `accent` | Cor da marca: fundo do botão primário |
| `accentText` | Cor da marca usada como **texto** (links, destaques) sobre `bg` e `paper` |
| `onAccent` | Texto sobre `accent` |
| `moss` | Sucesso (texto) |
| `amber` | Alerta (preenchimentos) |
| `amberInk` | Alerta (texto) |
| `crimson` | Erro |
| `sidebarBg`, `sidebarFg`, `sidebarMuted` | Menu lateral |
| `overlay` | Fundo escurecido de modal e gaveta (`rgb(… / alfa)`) |

Todas em `#rrggbb`, exceto `overlay`. O tema escuro repete os 16 (pode reaproveitar os valores do claro onde não mudam).

## Contraste verificado

`src/lib/marca/marca.test.ts` percorre **todas** as pastas de `src/brands` e confere, nos temas claro e escuro, estes pares com razão mínima de **4,5:1** (WCAG AA para texto normal): `fg/bg`, `fg/paper`, `muted/bg`, `muted/paper`, `accentText/bg`, `accentText/paper`, `onAccent/accent`, `moss`, `amberInk` e `crimson` sobre `bg` e `paper`, `sidebarFg/sidebarBg` e `sidebarMuted/sidebarBg`. Também confere o formato das cores, que o `id` seja o nome da pasta e que exista `fonts.ts`.

Dica: botão primário com texto branco costuma falhar em cores vivas (coral, laranja, ciano). Nesse caso use texto escuro em `onAccent`, como as marcas `claudaccount` e `exemplo`.

## Como funciona por dentro

- **Escolha da marca.** `next.config.ts` lê `BRAND` e aponta dois aliases do Turbopack, `@brand/marca` e `@brand/fonts`, para a pasta escolhida. O `tsconfig.json` mapeia os mesmos aliases para a marca padrão só para a tipagem (todas as marcas têm o mesmo formato).
- **Tema.** `lib/marca/tema.ts` gera o CSS (`:root{…}` e `:root[data-theme="dark"]{…}`) e o layout o injeta num `<style>` no `<head>`. `globals.css` apenas mapeia as variáveis para os utilitários do Tailwind. Por isso nenhum componente conhece cor de marca.
- **Logo.** O componente `Logo` mostra o logo da marca ou, sem logo, o nome em texto. No login e no topo do celular acompanha o tema da página.
- **Fontes.** Cada marca declara as suas; o Tailwind lê `--font-marca-display` (títulos e números) e `--font-marca-texto` (interface).
- **Assinatura.** A fonte e a cor do wordmark AUTTOPUS são próprias e fixas (`--font-oswald` no layout raiz), independentes da marca.

## O que o whitelabel não muda

Os textos de negócio (contabilidade, NFS-e, guias, "escritório") e a estrutura das telas são iguais em todas as marcas. Se uma instalação precisar de textos diferentes, isso é uma evolução separada, não parte do whitelabel visual.
