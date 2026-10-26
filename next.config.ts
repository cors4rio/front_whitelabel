import { existsSync } from "node:fs";

import type { NextConfig } from "next";

// Em desenvolvimento o front chama /api/* e o Next repassa ao backend (mesma origem: sem CORS e o cookie
// de refresh funciona). Em produção quem faz isso é o nginx, antes de a requisição chegar aqui.
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8080";

// Módulo de Notas Fiscais (ver src/lib/notas/modo.ts): "demo" (simulação no navegador), "api" (backend de verdade)
// ou desligado. Enquanto o backend do módulo não existe, o padrão é demo em desenvolvimento e desligado em
// qualquer build de produção; NEXT_PUBLIC_NOTAS_FISCAIS no ambiente do build sobrescreve. Fica aqui, e não num
// .env, para o padrão valer em quem clonar o repositório (os .env são ignorados pelo git).
const notasFiscais = process.env.NEXT_PUBLIC_NOTAS_FISCAIS ?? (process.env.NODE_ENV === "development" ? "demo" : "");

// Whitelabel por build: BRAND escolhe a pasta de src/brands (padrão: claudaccount). "@brand/marca" e "@brand/fonts"
// apontam para a marca escolhida; o tsconfig mapeia os dois para a marca padrão só para a tipagem (todas têm o mesmo formato).
const marcaId = process.env.BRAND ?? "claudaccount";
if (!/^[a-z0-9-]+$/.test(marcaId) || !existsSync(`./src/brands/${marcaId}/marca.ts`)) {
  throw new Error(`BRAND="${marcaId}" não existe: crie src/brands/${marcaId}/marca.ts e fonts.ts (modelo: src/brands/exemplo).`);
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  env: { NEXT_PUBLIC_NOTAS_FISCAIS: notasFiscais },
  turbopack: {
    resolveAlias: {
      "@brand/marca": `./src/brands/${marcaId}/marca.ts`,
      "@brand/fonts": `./src/brands/${marcaId}/fonts.ts`,
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
